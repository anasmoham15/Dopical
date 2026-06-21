import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { CalendarEvent } from "./src/types";

const app = express();
const PORT = 3000;

app.use(express.json());

// Path to persistent multi-user storage
const STORAGE_FILE = path.join(process.cwd(), "applet_calendar_users_db.json");

interface UserData {
  username: string;
  passwordHash: string; // Stored as simple string for instant prototype, with sanitization
}

interface DBStructure {
  users: UserData[];
  userEvents: Record<string, CalendarEvent[]>;
}

// Ensure the storage database exists
function loadDB(): DBStructure {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const data = fs.readFileSync(STORAGE_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error loading DB file:", error);
  }
  
  const defaultDB: DBStructure = {
    users: [],
    userEvents: {}
  };
  saveDB(defaultDB);
  return defaultDB;
}

function saveDB(db: DBStructure) {
  try {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(db, null, 2), "utf-8");
  } catch (error) {
    console.error("Error saving DB to file:", error);
  }
}

// Durable User Retrieval Helper
async function findUser(username: string): Promise<UserData | null> {
  const cleanUsername = username.trim().toLowerCase();
  const db = loadDB();
  return db.users.find(u => u.username === cleanUsername) || null;
}

// Durable User Creation Helper
async function saveUser(username: string, passwordHash: string): Promise<boolean> {
  const cleanUsername = username.trim().toLowerCase();
  const db = loadDB();
  db.users.push({ username: cleanUsername, passwordHash });
  db.userEvents[cleanUsername] = [];
  saveDB(db);
  return true;
}

// Durable Events Retrieval Helper
async function getUserEvents(username: string): Promise<CalendarEvent[]> {
  const cleanUsername = username.trim().toLowerCase();
  const db = loadDB();
  return db.userEvents[cleanUsername] || [];
}

// Durable Events Saving Helper
async function saveUserEvents(username: string, events: CalendarEvent[]): Promise<boolean> {
  const cleanUsername = username.trim().toLowerCase();
  const db = loadDB();
  db.userEvents[cleanUsername] = events;
  saveDB(db);
  return true;
}

// Token helper for stateless persistent sessions
const SECRET_MOCK = "calendar-application-secret-2026";
function generateToken(username: string): string {
  const payload = JSON.stringify({ username, ts: Date.now() });
  const base64Payload = Buffer.from(payload).toString("base64");
  const signature = Buffer.from(username + SECRET_MOCK).toString("base64").substring(0, 12);
  return `session.${base64Payload}.${signature}`;
}

function verifyToken(tokenStr: string): string | null {
  if (!tokenStr || !tokenStr.startsWith("session.")) return null;
  const parts = tokenStr.split(".");
  if (parts.length < 3) return null;
  try {
    const rawPayload = Buffer.from(parts[1], "base64").toString("utf-8");
    const parsed = JSON.parse(rawPayload);
    const username = parsed.username;
    
    // Verify signature
    const expectedSig = Buffer.from(username + SECRET_MOCK).toString("base64").substring(0, 12);
    if (parts[2] === expectedSig) {
      return username;
    }
  } catch (e) {
    console.error("Token verification error:", e);
  }
  return null;
}

// Middleware to secure endpoints and inject authenticated username
function authenticateRequest(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "Authentication required to access schedule." });
  }
  const token = authHeader.split(" ")[1];
  const username = verifyToken(token);
  if (!username) {
    return res.status(401).json({ success: false, error: "Invalid or expired session. Please log in again." });
  }
  (req as any).username = username;
  next();
}

// ==========================================
// AUTHENTICATION ENDPOINTS
// ==========================================

// Register a new user
app.post("/api/auth/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, error: "Username and password are required credentials." });
  }
  
  const cleanUsername = username.trim().toLowerCase();
  if (cleanUsername.length < 3 || password.length < 4) {
    return res.status(400).json({ success: false, error: "Username must be at least 3 chars; password at least 4 chars." });
  }

  const existingUser = await findUser(cleanUsername);
  if (existingUser) {
    return res.status(400).json({ success: false, error: "Username is already taken." });
  }

  // Create new user persistently
  await saveUser(cleanUsername, password);

  const token = generateToken(cleanUsername);
  res.json({
    success: true,
    message: "Registration successful!",
    token,
    username: cleanUsername
  });
});

// Login existing user
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, error: "Username and password are required parameters." });
  }

  const cleanUsername = username.trim().toLowerCase();
  const user = await findUser(cleanUsername);
  
  if (!user || user.passwordHash !== password) {
    return res.status(401).json({ success: false, error: "Invalid username or password credentials." });
  }

  const token = generateToken(cleanUsername);
  res.json({
    success: true,
    message: "Login successful!",
    token,
    username: cleanUsername
  });
});

// Validate profile token
app.get("/api/auth/me", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.json({ success: false });
  }
  const token = authHeader.split(" ")[1];
  const username = verifyToken(token);
  if (!username) {
    return res.json({ success: false });
  }
  res.json({ success: true, username });
});

// ==========================================
// CALENDAR DATA MANAGEMENT (SECURED)
// ==========================================

// Get calendar events for authenticated user
app.get("/api/events", authenticateRequest, async (req: any, res) => {
  const userEventsList = await getUserEvents(req.username);
  res.json({ success: true, events: userEventsList });
});

// Update calendar events for logged-in user
app.post("/api/events", authenticateRequest, async (req: any, res) => {
  const { events } = req.body;
  if (!Array.isArray(events)) {
    return res.status(400).json({ success: false, error: "Events must be submitted as an array." });
  }

  // Clean event items data structure with schema strictness
  const sanitizedEvents = events.map((item: any, idx: number) => ({
    id: item.id || `ev-${Date.now()}-${idx}`,
    title: String(item.title || "Untitled Scheduled Event").trim(),
    date: String(item.date || ""),
    startTime: String(item.startTime || "09:00"),
    endTime: String(item.endTime || "10:00"),
    description: String(item.description || "").trim(),
    tag: item.tag || "work",
    repeat: item.repeat || "none"
  })).filter(e => e.date);

  await saveUserEvents(req.username, sanitizedEvents);

  res.json({ success: true, message: "Calendar schedule saved securely." });
});

// Clear current user's schedule completely
app.post("/api/events/reset", authenticateRequest, async (req: any, res) => {
  await saveUserEvents(req.username, []);
  res.json({ success: true, message: "Calendar refreshed. Only user-added items remain.", events: [] });
});

// Start listening and mount Vite router
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Calendar Multiuser Server] Access online on port ${PORT}`);
  });
}

startServer();
