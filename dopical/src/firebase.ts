import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, deleteDoc } from "firebase/firestore";
import rawConfig from "../firebase-applet-config.json";
import { CalendarEvent } from "./types";

// Prepare Firebase Config to support either standard file loading or secure environment variables
const config = {
  apiKey: (import.meta as any).env.VITE_FIREBASE_API_KEY || rawConfig.apiKey,
  authDomain: (import.meta as any).env.VITE_FIREBASE_AUTH_DOMAIN || rawConfig.authDomain,
  projectId: (import.meta as any).env.VITE_FIREBASE_PROJECT_ID || rawConfig.projectId,
  storageBucket: (import.meta as any).env.VITE_FIREBASE_STORAGE_BUCKET || rawConfig.storageBucket,
  messagingSenderId: (import.meta as any).env.VITE_FIREBASE_MESSAGING_SENDER_ID || rawConfig.messagingSenderId,
  appId: (import.meta as any).env.VITE_FIREBASE_APP_ID || rawConfig.appId,
  firestoreDatabaseId: (import.meta as any).env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || rawConfig.firestoreDatabaseId
};

// Initialize client side SDK using loaded JSON config
const app = initializeApp(config);
export const db = getFirestore(app, config.firestoreDatabaseId);

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

// Global exception/telemetry helper mapped in accordance with skill definition
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: "client-system",
      email: null,
      emailVerified: false,
      isAnonymous: true,
      tenantId: null,
      providerInfo: [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error Telemetry: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// User credentials and events schema helpers
export interface UserData {
  username: string;
  passwordHash: string;
  sharedWith?: string[];     // Usernames of people WHO CAN view my calendar
  canView?: string[];        // Usernames of people WHOSE calendars I can view
  incomingRequests?: string[]; // Usernames of people requesting to view my calendar
}

export async function findUserFirebase(username: string): Promise<UserData | null> {
  const cleanUsername = username.trim().toLowerCase();
  const pathForGet = `users/${cleanUsername}`;
  try {
    const docRef = doc(db, "users", cleanUsername);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as UserData;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, pathForGet);
  }
}

export async function saveUserFirebase(username: string, passwordHash: string): Promise<void> {
  const cleanUsername = username.trim().toLowerCase();
  const pathForWrite = `users/${cleanUsername}`;
  try {
    const docRef = doc(db, "users", cleanUsername);
    await setDoc(docRef, { 
      username: cleanUsername, 
      passwordHash,
      sharedWith: [],
      canView: [],
      incomingRequests: []
    });
    
    // Create companion event slot space
    await setDoc(doc(db, "userEvents", cleanUsername), { events: [] });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, pathForWrite);
  }
}

export async function getUserEventsFirebase(username: string): Promise<CalendarEvent[]> {
  const cleanUsername = username.trim().toLowerCase();
  const pathForGet = `userEvents/${cleanUsername}`;
  try {
    const docRef = doc(db, "userEvents", cleanUsername);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return (docSnap.data()?.events || []) as CalendarEvent[];
    }
    return [];
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, pathForGet);
  }
}

export async function saveUserEventsFirebase(username: string, events: CalendarEvent[]): Promise<void> {
  const cleanUsername = username.trim().toLowerCase();
  const pathForWrite = `userEvents/${cleanUsername}`;
  try {
    const docRef = doc(db, "userEvents", cleanUsername);
    await setDoc(docRef, { events });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, pathForWrite);
  }
}

export function subscribeUserEventsFirebase(
  username: string,
  onUpdate: (events: CalendarEvent[]) => void,
  onErr: (error: any) => void
): () => void {
  const cleanUsername = username.trim().toLowerCase();
  const pathForGet = `userEvents/${cleanUsername}`;
  try {
    const docRef = doc(db, "userEvents", cleanUsername);
    return onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          onUpdate((docSnap.data()?.events || []) as CalendarEvent[]);
        } else {
          onUpdate([]);
        }
      },
      (error) => {
        onErr(error);
      }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, pathForGet);
  }
}

export async function hashPassword(password: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function deleteUserFirebase(username: string): Promise<void> {
  const cleanUsername = username.trim().toLowerCase();
  const pathForUser = `users/${cleanUsername}`;
  try {
    const userDocRef = doc(db, "users", cleanUsername);
    const eventsDocRef = doc(db, "userEvents", cleanUsername);
    await deleteDoc(userDocRef);
    await deleteDoc(eventsDocRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, pathForUser);
  }
}

// Subscribe to real-time updates on User Profile details (for requests, permissions etc)
export function subscribeUserProfileFirebase(
  username: string,
  onUpdate: (data: UserData) => void,
  onErr: (err: any) => void
): () => void {
  const cleanUsername = username.trim().toLowerCase();
  const pathForGet = `users/${cleanUsername}`;
  try {
    const docRef = doc(db, "users", cleanUsername);
    return onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          onUpdate(docSnap.data() as UserData);
        }
      },
      (error) => {
        onErr(error);
      }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, pathForGet);
  }
}

// Request permission to view another user's calendar
export async function sendSharingRequest(sender: string, receiver: string): Promise<string> {
  const cleanSender = sender.trim().toLowerCase();
  const cleanReceiver = receiver.trim().toLowerCase();
  
  if (cleanSender === cleanReceiver) {
    throw new Error("You cannot share a timetable with yourself!");
  }

  const receiverData = await findUserFirebase(cleanReceiver);
  if (!receiverData) {
    throw new Error(`User "${cleanReceiver}" does not exist in our matching prefixes.`);
  }

  const receiverRef = doc(db, "users", cleanReceiver);
  
  // Initialize fields if they're missing
  const currentRequests = receiverData.incomingRequests || [];
  const currentSharedWith = receiverData.sharedWith || [];

  if (currentRequests.includes(cleanSender)) {
    throw new Error(`You have already submitted a pending request to @${cleanReceiver}.`);
  }

  if (currentSharedWith.includes(cleanSender)) {
    throw new Error(`@${cleanReceiver} has already approved and shared their timetable with you.`);
  }

  // Update receiver document to include sender request
  await updateDoc(receiverRef, {
    incomingRequests: [...currentRequests, cleanSender]
  });

  return `Access request sent successfully to @${cleanReceiver}!`;
}

// Handle incoming sharing request approval / rejection
export async function respondToSharingRequest(
  receiver: string,
  sender: string,
  approve: boolean
): Promise<void> {
  const cleanReceiver = receiver.trim().toLowerCase();
  const cleanSender = sender.trim().toLowerCase();

  const receiverData = await findUserFirebase(cleanReceiver);
  const senderData = await findUserFirebase(cleanSender);

  if (!receiverData || !senderData) {
    throw new Error("Data connection sync failure. User record invalid.");
  }

  const receiverRef = doc(db, "users", cleanReceiver);
  const senderRef = doc(db, "users", cleanSender);

  const incoming = receiverData.incomingRequests || [];
  const updatedIncoming = incoming.filter(u => u !== cleanSender);

  if (approve) {
    const sharedWith = receiverData.sharedWith || [];
    const canView = senderData.canView || [];

    await updateDoc(receiverRef, {
      incomingRequests: updatedIncoming,
      sharedWith: Array.from(new Set([...sharedWith, cleanSender]))
    });

    await updateDoc(senderRef, {
      canView: Array.from(new Set([...canView, cleanReceiver]))
    });
  } else {
    await updateDoc(receiverRef, {
      incomingRequests: updatedIncoming
    });
  }
}

// Revoke access permission granted to another user
export async function revokeSharingPermission(
  revoker: string,
  target: string
): Promise<void> {
  const cleanRevoker = revoker.trim().toLowerCase();
  const cleanTarget = target.trim().toLowerCase();

  const revokerData = await findUserFirebase(cleanRevoker);
  const targetData = await findUserFirebase(cleanTarget);

  if (!revokerData || !targetData) {
    throw new Error("Network latency sync failure.");
  }

  const revokerRef = doc(db, "users", cleanRevoker);
  const targetRef = doc(db, "users", cleanTarget);

  const shared = revokerData.sharedWith || [];
  const views = targetData.canView || [];

  await updateDoc(revokerRef, {
    sharedWith: shared.filter(u => u !== cleanTarget)
  });

  await updateDoc(targetRef, {
    canView: views.filter(u => u !== cleanRevoker)
  });
}
