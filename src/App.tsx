import { useState, useEffect, useMemo, FormEvent, MouseEvent, useRef } from "react";
import { 
  Calendar, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  Trash2, 
  X, 
  Copy, 
  Briefcase, 
  User, 
  Heart, 
  Sparkles, 
  RefreshCw, 
  Check, 
  Clock, 
  Lock, 
  UserPlus, 
  LogIn, 
  LogOut, 
  Repeat,
  FileSpreadsheet,
  Sun,
  Moon,
  Gift,
  GraduationCap,
  DollarSign,
  Users,
  Settings,
  Shield,
  Share2,
  UserCheck
} from "lucide-react";
import { CalendarEvent, CalendarTag, DayInfo } from "./types";
import { expandEventsForRange } from "./utils/recurring";
import { 
  findUserFirebase, 
  saveUserFirebase, 
  getUserEventsFirebase, 
  saveUserEventsFirebase, 
  subscribeUserEventsFirebase, 
  hashPassword, 
  deleteUserFirebase,
  subscribeUserProfileFirebase,
  sendSharingRequest,
  respondToSharingRequest,
  revokeSharingPermission,
  UserData
} from "./firebase";

// Polished Category Config with beautiful custom styling matches requested Tags
const TAG_CONFIG: Record<CalendarTag, { label: string; bg: string; border: string; text: string; icon: any; marker: string }> = {
  work: { label: "Work", bg: "bg-indigo-50/70", border: "border-indigo-150", text: "text-indigo-700", icon: Briefcase, marker: "bg-indigo-600" },
  fitness: { label: "Fitness", bg: "bg-rose-50/70", border: "border-rose-150", text: "text-rose-700", icon: Heart, marker: "bg-rose-600" },
  sleep: { label: "Sleep", bg: "bg-sky-50/70", border: "border-sky-150", text: "text-sky-700", icon: Clock, marker: "bg-sky-600" },
  faith: { label: "Faith", bg: "bg-amber-50/70", border: "border-amber-150", text: "text-amber-800", icon: Sparkles, marker: "bg-amber-600" },
  personal: { label: "Personal", bg: "bg-emerald-50/70", border: "border-emerald-150", text: "text-emerald-700", icon: User, marker: "bg-emerald-600" },
  socials: { label: "Socials", bg: "bg-purple-50/70", border: "border-purple-150", text: "text-purple-700", icon: Users, marker: "bg-purple-600" },
  holiday: { label: "Holiday", bg: "bg-orange-50/70", border: "border-orange-150", text: "text-orange-700", icon: Gift, marker: "bg-orange-600" },
  education: { label: "Education", bg: "bg-fuchsia-50/70", border: "border-fuchsia-150", text: "text-fuchsia-700", icon: GraduationCap, marker: "bg-fuchsia-600" },
  finance: { label: "Finance", bg: "bg-teal-50/70", border: "border-teal-150", text: "text-teal-700", icon: DollarSign, marker: "bg-teal-600" }
};

const getTagStyles = (tag: CalendarTag, isDark: boolean) => {
  const config = TAG_CONFIG[tag] || TAG_CONFIG.socials;
  if (!isDark) {
    return {
      bg: config.bg,
      border: config.border,
      text: config.text
    };
  }
  switch (tag) {
    case "work":
      return { bg: "bg-indigo-950/40", border: "border-indigo-900/60", text: "text-indigo-305" };
    case "fitness":
      return { bg: "bg-rose-950/40", border: "border-rose-900/60", text: "text-rose-300" };
    case "sleep":
      return { bg: "bg-sky-950/40", border: "border-sky-900/60", text: "text-sky-305" };
    case "faith":
      return { bg: "bg-amber-950/40", border: "border-amber-900/60", text: "text-amber-305" };
    case "personal":
      return { bg: "bg-emerald-950/40", border: "border-emerald-900/60", text: "text-emerald-305" };
    case "socials":
      return { bg: "bg-purple-950/40", border: "border-purple-900/60", text: "text-purple-305" };
    case "holiday":
      return { bg: "bg-orange-950/40", border: "border-orange-900/60", text: "text-orange-305" };
    case "education":
      return { bg: "bg-fuchsia-950/40", border: "border-fuchsia-900/60", text: "text-fuchsia-305" };
    case "finance":
      return { bg: "bg-teal-950/40", border: "border-teal-900/60", text: "text-teal-300" };
    default:
      return { bg: "bg-purple-950/40", border: "border-purple-900/60", text: "text-purple-305" };
  }
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June", 
  "July", "August", "September", "October", "November", "December"
];

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function App() {
  // Authentication & Session States
  const [userToken, setUserToken] = useState<string | null>(() => localStorage.getItem("calendar_jwt_token"));
  const [username, setUsername] = useState<string | null>(() => localStorage.getItem("calendar_username"));
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authUsername, setAuthUsername] = useState<string>("");
  const [authPassword, setAuthPassword] = useState<string>("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  // Calendar View Date States
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Sharing, Privacy, and Mutual Gaps States
  const [userProfile, setUserProfile] = useState<UserData | null>(null);
  const [isSharingOpen, setIsSharingOpen] = useState<boolean>(false);
  const [friendSearchName, setFriendSearchName] = useState<string>("");
  const [friendSearchError, setFriendSearchError] = useState<string | null>(null);
  const [friendSearchSuccess, setFriendSearchSuccess] = useState<string | null>(null);
  const [viewedFriendEvents, setViewedFriendEvents] = useState<Record<string, CalendarEvent[]>>({});
  const [activeCompareFriends, setActiveCompareFriends] = useState<string[]>([]);

  // Monetization (Dopical Support / Promotion Code System)
  const [isPremium, setIsPremium] = useState<boolean>(() => {
    return localStorage.getItem("dopical_premium_active") === "true";
  });
  const [promoCodeInput, setPromoCodeInput] = useState<string>("");
  const [promoFeedback, setPromoFeedback] = useState<string | null>(null);
  const [supportLink] = useState<string>(() => {
    return (
      (import.meta as any).env.VITE_SUPPORT_LINK ||
      "https://buymeacoffee.com/anasmohamud"
    );
  });

  // Selected Day Highlight (Defaults to today's date string)
  const [selectedDayString, setSelectedDayString] = useState<string>(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });

  // Scheduling Form / Action State (Hosted directly on the Right Sidebar)
  const [editEventId, setEditEventId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState<string>("");
  const [formStartTime, setFormStartTime] = useState<string>("09:00");
  const [formEndTime, setFormEndTime] = useState<string>("10:00");
  const [formTag, setFormTag] = useState<CalendarTag>("work");
  const [formDescription, setFormDescription] = useState<string>("");
  const [formRepeat, setFormRepeat] = useState<"none" | "daily" | "weekly" | "monthly">("none");

  // Copy to Dates Feature State
  const [copySourceEvent, setCopySourceEvent] = useState<CalendarEvent | null>(null);
  const [copyTargetDates, setCopyTargetDates] = useState<string[]>([]);
  const [copyCalDate, setCopyCalDate] = useState<Date>(new Date());

  // Feedback notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // View mode for the daily scheduler sidebar (defaults to visual timetable)
  const [sidebarViewMode, setSidebarViewMode] = useState<"timeline" | "list">("timeline");
  const [leftSidebarTab, setLeftSidebarTab] = useState<"agenda" | "sharing">("agenda");
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll visual timeline to center normal hours (07:00 start)
  useEffect(() => {
    if (sidebarViewMode === "timeline" && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 315;
    }
  }, [selectedDayString, sidebarViewMode]);

  // Theme states
  const [theme, setTheme] = useState<"light" | "dark">(() => (localStorage.getItem("harmony_calendar_theme") as "light" | "dark") || "light");

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("harmony_calendar_theme", nextTheme);
    triggerToast(`Switched to ${nextTheme} theme`);
  };

  // Status feedback helper
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Check and validate the stored session on boot
  useEffect(() => {
    const savedToken = localStorage.getItem("calendar_jwt_token");
    const savedUser = localStorage.getItem("calendar_username");
    
    if (savedToken && savedUser) {
      setUserToken(savedToken);
      setUsername(savedUser);
    }
  }, []);

  // Real-time synchronization subscription
  useEffect(() => {
    if (!username) return;

    setIsLoading(true);
    const unsubscribe = subscribeUserEventsFirebase(
      username,
      (fetchedEvents) => {
        setEvents(fetchedEvents || []);
        setIsLoading(false);
      },
      (error) => {
        console.error("Real-time sync error:", error);
        triggerToast("Failed to sync in real-time. Check permissions.");
        setIsLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [username]);

  // Real-time user profile details subscription
  useEffect(() => {
    if (!username) {
      setUserProfile(null);
      return;
    }

    const unsubscribe = subscribeUserProfileFirebase(
      username,
      (profileData) => {
        setUserProfile(profileData);
      },
      (error) => {
        console.error("User profile subscription error:", error);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [username]);

  // Handle active compare friends event fetch (caching friend calendars instantly)
  useEffect(() => {
    if (!username || activeCompareFriends.length === 0) return;

    activeCompareFriends.forEach(async (friend) => {
      if (viewedFriendEvents[friend]) return; // already cached
      try {
        const friendEv = await getUserEventsFirebase(friend);
        setViewedFriendEvents(prev => ({
          ...prev,
          [friend]: friendEv || []
        }));
      } catch (err) {
        console.error(`Failed to load @${friend}'s events:`, err);
      }
    });
  }, [activeCompareFriends, username, viewedFriendEvents]);

  // Perform backend logout cleanups
  const handleLogout = () => {
    localStorage.removeItem("calendar_jwt_token");
    localStorage.removeItem("calendar_username");
    setUserToken(null);
    setUsername(null);
    setEvents([]);
    setAuthUsername("");
    setAuthPassword("");
    setAuthError(null);
    triggerToast("Logged out successfully.");
  };

  // Submit handler for Logins
  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const cleanUser = authUsername.trim().toLowerCase();
    if (!cleanUser || !authPassword) {
      setAuthError("Please fill out all credentials.");
      return;
    }
    setAuthLoading(true);
    setAuthError(null);

    try {
      const userDoc = await findUserFirebase(cleanUser);
      const hashedPassword = await hashPassword(authPassword);
      if (userDoc && (userDoc.passwordHash === hashedPassword || userDoc.passwordHash === authPassword)) {
        localStorage.setItem("calendar_jwt_token", cleanUser);
        localStorage.setItem("calendar_username", cleanUser);
        setUserToken(cleanUser);
        setUsername(cleanUser);
        triggerToast(`Welcome, ${cleanUser}!`);
      } else {
        setAuthError("Credentials invalid.");
      }
    } catch (err) {
      console.error("Login connection error:", err);
      setAuthError("Failed to connect to cloud database.");
    } finally {
      setAuthLoading(false);
    }
  };

  // Submit handler for Registers
  const handleRegisterSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const cleanUser = authUsername.trim().toLowerCase();
    if (!cleanUser || !authPassword) {
      setAuthError("All input fields are required.");
      return;
    }
    if (cleanUser.length < 3) {
      setAuthError("Username must be at least 3 characters.");
      return;
    }
    if (authPassword.length < 4) {
      setAuthError("Password must be at least 4 characters.");
      return;
    }
    setAuthLoading(true);
    setAuthError(null);

    try {
      const existingUser = await findUserFirebase(cleanUser);
      if (existingUser) {
        setAuthError("Username is already taken.");
        return;
      }

      const hashedPassword = await hashPassword(authPassword);
      await saveUserFirebase(cleanUser, hashedPassword);
      localStorage.setItem("calendar_jwt_token", cleanUser);
      localStorage.setItem("calendar_username", cleanUser);
      setUserToken(cleanUser);
      setUsername(cleanUser);
      triggerToast("Account registered successfully!");
      setEvents([]);
    } catch (err) {
      console.error("Register error:", err);
      setAuthError("Could not resolve registration connection.");
    } finally {
      setAuthLoading(false);
    }
  };

  // Push updates to backend with protective limits (prevents database spam, high billing, and crashes)
  const syncWithServer = async (updatedEvents: CalendarEvent[]) => {
    if (!username) return;
    
    // Safety guard to protect database boundaries and respect free tier limits
    const limitMax = isPremium ? 500 : 100;
    if (updatedEvents.length > limitMax) {
      triggerToast(`Timetable space limit reached (max ${limitMax} events on your current plan). Upgrade or clear options in Settings.`);
      return;
    }

    setSyncing(true);
    try {
      await saveUserEventsFirebase(username, updatedEvents);
    } catch (err) {
      console.error("Sync error:", err);
      setEvents(updatedEvents);
      triggerToast("Saved locally in browser memory.");
    } finally {
      setSyncing(false);
    }
  };

  // Clear all events
  const handleClearAllEvents = async () => {
    if (!window.confirm("Do you really want to clear your calendar events permanently? Only your scheduled items will be removed.")) return;
    await syncWithServer([]);
    triggerToast("Your calendar has been cleared.");
    handleResetForm();
  };

  // Data Portability compliance (GDPR Right to Portability - export user calendar)
  const handleExportEvents = () => {
    if (!username) return;
    if (events.length === 0) {
      triggerToast("You do not have any events to export.");
      return;
    }
    try {
      const backupDataString = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(events, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", backupDataString);
      downloadAnchor.setAttribute("download", `dopical_calendar_backup_${username}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      triggerToast("Your calendar backup file has been generated and downloaded!");
    } catch (err) {
      console.error("Failed to export events JSON:", err);
      triggerToast("Could not generate calendar backup. Please try again.");
    }
  };

  // GDPR Right To Be Forgotten compliance (Permanently erase credential records and event assets)
  const handleDeleteAccount = async () => {
    if (!username) return;
    const confirmationText = `Are you absolutely sure you want to permanently delete your Dopical profile "@${username}"?\n\nThis will purge your credentials and completely erase all scheduled calendar events from our system.\nThis operation is irreversible!`;
    if (!window.confirm(confirmationText)) return;

    try {
      setSyncing(true);
      await deleteUserFirebase(username);
      setIsSettingsOpen(false);

      // Reset login state and clear persistent cache
      localStorage.removeItem("calendar_jwt_token");
      localStorage.removeItem("calendar_username");
      setUserToken(null);
      setUsername(null);
      setEvents([]);
      setAuthUsername("");
      setAuthPassword("");
      setAuthError(null);

      triggerToast("Your Dopical profile and scheduled events have been securely and permanently deleted.");
    } catch (err) {
      console.error("Account erasure failure:", err);
      triggerToast("Data connection error. Could not erase user profile.");
    } finally {
      setSyncing(false);
    }
  };

  // Send sharing permission request
  const handleSendRequestSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username) return;
    const cleanSearchName = friendSearchName.trim().toLowerCase();
    if (!cleanSearchName) {
      setFriendSearchError("Please enter a username.");
      return;
    }

    setFriendSearchError(null);
    setFriendSearchSuccess(null);
    try {
      const msg = await sendSharingRequest(username, cleanSearchName);
      setFriendSearchSuccess(msg);
      setFriendSearchName("");
      triggerToast("Request dispatched!");
    } catch (err: any) {
      setFriendSearchError(err.message || "Failed to dispatch sharing request.");
    }
  };

  // Accept or Decline pending access requests
  const handleRespondRequest = async (requester: string, approve: boolean) => {
    if (!username) return;
    try {
      await respondToSharingRequest(username, requester, approve);
      triggerToast(approve ? `Authorized request from @${requester}!` : `Declined request from @${requester}.`);
    } catch (err) {
      console.error(err);
      triggerToast("Could not submit request decision.");
    }
  };

  // Revoke approved sharing options
  const handleRevokePermission = async (targetUser: string) => {
    if (!username) return;
    if (!window.confirm(`Revoke @${targetUser}'s permission to view your calendar details?`)) return;
    try {
      await revokeSharingPermission(username, targetUser);
      // Remove from comparisons if active
      setActiveCompareFriends(prev => prev.filter(f => f !== targetUser));
      triggerToast(`Removed view authorization for @${targetUser}.`);
    } catch (err) {
      console.error(err);
      triggerToast("Failed to revoke authorization.");
    }
  };

  // Toggle overlaying a friend's calendar events
  const toggleCompareFriend = (friend: string) => {
    setActiveCompareFriends(prev => {
      if (prev.includes(friend)) {
        return prev.filter(f => f !== friend);
      } else {
        return [...prev, friend];
      }
    });
  };

  // Support Pledge verification code
  const handleVerifyPremiumCode = (e: FormEvent) => {
    e.preventDefault();
    const cleanedCode = promoCodeInput.trim().toUpperCase();
    if (!cleanedCode) return;

    if (cleanedCode === "DOPICAL_CHAMPION" || cleanedCode === "DOPICAL_CHAMPION_2026" || cleanedCode === "DOPICAL_PREMIUM") {
      setIsPremium(true);
      localStorage.setItem("dopical_premium_active", "true");
      setPromoFeedback("🎉 Premium Support Active! Event capacity is expanded to 500 fields and advanced comparisons are unlocked.");
      setPromoCodeInput("");
      triggerToast("Dopical Premium Activated!");
    } else {
      setPromoFeedback("❌ Matching verification code not found. Type 'DOPICAL_CHAMPION' to test offline billing protection.");
    }
  };

  // Formatted date values
  const year = currentDate.getFullYear();
  const monthIdx = currentDate.getMonth();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, monthIdx - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, monthIdx + 1, 1));
  };

  const handleGoToday = () => {
    const today = new Date();
    setCurrentDate(today);
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const formatted = `${yyyy}-${mm}-${dd}`;
    setSelectedDayString(formatted);
  };

  const formatDateString = (date: Date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const isTodayDate = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  // Copy to Dates Core Logic & Month computations
  const handleInitiateCopyEvent = (event: CalendarEvent) => {
    setCopySourceEvent(event);
    setCopyTargetDates([]);
    setCopyCalDate(new Date(event.date + "T00:00:00"));
  };

  const handleToggleCopyTargetDate = (dateStr: string) => {
    setCopyTargetDates(prev => {
      if (prev.includes(dateStr)) {
        return prev.filter(d => d !== dateStr);
      } else {
        return [...prev, dateStr];
      }
    });
  };

  const handleCommitDuplicateEvents = async () => {
    if (!copySourceEvent) return;
    if (copyTargetDates.length === 0) {
      triggerToast("Please select at least one target date.");
      return;
    }

    const duplicatedEvents = copyTargetDates.map((dateStr, idx) => {
      return {
        ...copySourceEvent,
        id: `ev-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
        date: dateStr,
        repeat: "none" as const // no repeat schedule
      };
    });

    const updated = [...events, ...duplicatedEvents];
    await syncWithServer(updated);
    triggerToast(`"${copySourceEvent.title}" copied to ${copyTargetDates.length} date(s).`);
    setCopySourceEvent(null);
    setCopyTargetDates([]);
  };

  const copyYear = copyCalDate.getFullYear();
  const copyMonthIdx = copyCalDate.getMonth();

  const copyCalendarCells = useMemo(() => {
    const firstDay = new Date(copyYear, copyMonthIdx, 1);
    const startDayOfWeek = firstDay.getDay(); 
    
    const totalDaysInMonth = new Date(copyYear, copyMonthIdx + 1, 0).getDate();
    const totalDaysInPrevMonth = new Date(copyYear, copyMonthIdx, 0).getDate();
    
    const dayCells: DayInfo[] = [];
    
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const prevDate = new Date(copyYear, copyMonthIdx - 1, totalDaysInPrevMonth - i);
      dayCells.push({
        dateString: formatDateString(prevDate),
        dayOfMonth: totalDaysInPrevMonth - i,
        isCurrentMonth: false,
        isToday: isTodayDate(prevDate)
      });
    }

    for (let i = 1; i <= totalDaysInMonth; i++) {
      const currDate = new Date(copyYear, copyMonthIdx, i);
      dayCells.push({
        dateString: formatDateString(currDate),
        dayOfMonth: i,
        isCurrentMonth: true,
        isToday: isTodayDate(currDate)
      });
    }

    const remaining = 42 - dayCells.length;
    for (let i = 1; i <= remaining; i++) {
      const nextDate = new Date(copyYear, copyMonthIdx + 1, i);
      dayCells.push({
        dateString: formatDateString(nextDate),
        dayOfMonth: i,
        isCurrentMonth: false,
        isToday: isTodayDate(nextDate)
      });
    }

    return dayCells;
  }, [copyYear, copyMonthIdx]);

  // 42-cell Month grid calculations
  const calendarCells = useMemo(() => {
    const firstDay = new Date(year, monthIdx, 1);
    const startDayOfWeek = firstDay.getDay(); 
    
    const totalDaysInMonth = new Date(year, monthIdx + 1, 0).getDate();
    const totalDaysInPrevMonth = new Date(year, monthIdx, 0).getDate();
    
    const dayCells: DayInfo[] = [];
    
    // Add previous month padding cells
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const prevDate = new Date(year, monthIdx - 1, totalDaysInPrevMonth - i);
      dayCells.push({
        dateString: formatDateString(prevDate),
        dayOfMonth: totalDaysInPrevMonth - i,
        isCurrentMonth: false,
        isToday: isTodayDate(prevDate)
      });
    }

    // Add current month days
    for (let i = 1; i <= totalDaysInMonth; i++) {
      const currDate = new Date(year, monthIdx, i);
      dayCells.push({
        dateString: formatDateString(currDate),
        dayOfMonth: i,
        isCurrentMonth: true,
        isToday: isTodayDate(currDate)
      });
    }

    // Add next month padding cells to make 42 grid blocks
    const remaining = 42 - dayCells.length;
    for (let i = 1; i <= remaining; i++) {
      const nextDate = new Date(year, monthIdx + 1, i);
      dayCells.push({
        dateString: formatDateString(nextDate),
        dayOfMonth: i,
        isCurrentMonth: false,
        isToday: isTodayDate(nextDate)
      });
    }

    return dayCells;
  }, [year, monthIdx]);

  // List of active date string codes visible inside the month table viewport
  const visibleDates = useMemo(() => {
    return calendarCells.map(c => c.dateString);
  }, [calendarCells]);

  // Expanded database lookup mapping for fast cell indicators (handles recurring items perfectly!)
  const eventsByDate = useMemo(() => {
    const lookup: Record<string, (CalendarEvent & { friendOwner?: string })[]> = {};
    const datesToCompute = visibleDates.includes(selectedDayString)
      ? visibleDates
      : [...visibleDates, selectedDayString];

    const occurrences = expandEventsForRange(events, datesToCompute);
    
    occurrences.forEach(({ event, occurrenceDate }) => {
      if (!lookup[occurrenceDate]) {
        lookup[occurrenceDate] = [];
      }
      lookup[occurrenceDate].push({
        ...event,
        date: occurrenceDate
      });
    });

    // Expand friend events when checked/active
    activeCompareFriends.forEach((friend) => {
      const friendEvs = viewedFriendEvents[friend] || [];
      const fOccurrences = expandEventsForRange(friendEvs, datesToCompute);
      fOccurrences.forEach(({ event, occurrenceDate }) => {
        if (!lookup[occurrenceDate]) {
          lookup[occurrenceDate] = [];
        }
        lookup[occurrenceDate].push({
          ...event,
          date: occurrenceDate,
          friendOwner: friend
        });
      });
    });

    Object.keys(lookup).forEach(d => {
      lookup[d].sort((a, b) => a.startTime.localeCompare(b.startTime));
    });

    return lookup;
  }, [events, visibleDates, selectedDayString, activeCompareFriends, viewedFriendEvents]);

  // Chronologically upcoming agenda of occurrences for the Left Sidebar
  const upcomingEventsChronological = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = formatDateString(today);

    // Compute future date strings for expansion (up to 30 days ahead)
    const futureDatesGroup: string[] = [];
    for (let i = 0; i < 30; i++) {
      const futureObj = new Date();
      futureObj.setDate(futureObj.getDate() + i);
      futureDatesGroup.push(formatDateString(futureObj));
    }

    const occurrences = expandEventsForRange(events, futureDatesGroup);
    const list: (CalendarEvent & { friendOwner?: string })[] = occurrences.map(({ event, occurrenceDate }) => ({
      ...event,
      date: occurrenceDate 
    }));

    activeCompareFriends.forEach((friend) => {
      const friendEvs = viewedFriendEvents[friend] || [];
      const fOccurrences = expandEventsForRange(friendEvs, futureDatesGroup);
      fOccurrences.forEach(({ event, occurrenceDate }) => {
        list.push({
          ...event,
          date: occurrenceDate,
          friendOwner: friend
        });
      });
    });

    return list.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.startTime.localeCompare(b.startTime);
    });
  }, [events, activeCompareFriends, viewedFriendEvents]);

  // Find mutual free slots for selected day (e.g. 08:00 to 20:00)
  const mutualFreeGaps = useMemo(() => {
    if (activeCompareFriends.length === 0) return [];
    
    // Create hourly slots from 08:00 to 20:00
    const slots = Array.from({ length: 13 }, (_, i) => 8 + i); // [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
    
    const dayEvents = eventsByDate[selectedDayString] || [];
    
    const isSlotBusy = (hour: number) => {
      const slotStart = hour * 60;
      const slotEnd = (hour + 1) * 60;
      
      const parseTimeToMinutes = (t: string): number => {
        const [h, m] = t.split(":").map(Number);
        return (h || 0) * 60 + (m || 0);
      };

      return dayEvents.some(ev => {
        const evStart = parseTimeToMinutes(ev.startTime);
        const evEnd = parseTimeToMinutes(ev.endTime);
        return evStart < slotEnd && evEnd > slotStart;
      });
    };

    const freeHours = slots.filter(h => !isSlotBusy(h));
    
    const gaps: string[] = [];
    if (freeHours.length > 0) {
      let start = freeHours[0];
      let prev = freeHours[0];
      
      for (let i = 1; i <= freeHours.length; i++) {
        const curr = freeHours[i];
        if (curr === prev + 1) {
          prev = curr;
        } else {
          const startStr = `${String(start).padStart(2, "0")}:00`;
          const endStr = `${String(prev + 1).padStart(2, "0")}:00`;
          gaps.push(`${startStr} - ${endStr}`);
          if (curr !== undefined) {
            start = curr;
            prev = curr;
          }
        }
      }
    }
    return gaps;
  }, [eventsByDate, selectedDayString, activeCompareFriends]);

  // Format string of currently chosen day (e.g. "Thursday, Jun 18, 2026")
  const selectedDayFormatted = useMemo(() => {
    if (!selectedDayString) return "";
    const parts = selectedDayString.split("-");
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  }, [selectedDayString]);

  // Reset/Clear scheduler forms
  const handleResetForm = () => {
    setEditEventId(null);
    setFormTitle("");
    setFormStartTime("09:00");
    setFormEndTime("10:00");
    setFormTag("work");
    setFormDescription("");
    setFormRepeat("none");
  };

  // Start scheduling a new custom event for a cell on hot hover click
  const handleQuickAddEvent = (e: MouseEvent, dateStr: string) => {
    e.stopPropagation();
    setSelectedDayString(dateStr);
    handleResetForm();
    setTimeout(() => {
      const el = document.getElementById("event-title-input");
      if (el) {
        el.focus();
      }
    }, 80);
  };

  // Fast direct delete handler
  const handleDeleteEventDirectly = async (id: string, eventTitle: string) => {
    const updated = events.filter(e => e.id !== id);
    await syncWithServer(updated);
    triggerToast(`"${eventTitle}" was removed.`);
    if (editEventId === id) {
      handleResetForm();
    }
  };

  // Populate form with existing event criteria for edits
  const handleInitiateEdit = (event: CalendarEvent) => {
    setEditEventId(event.id);
    setFormTitle(event.title);
    setFormStartTime(event.startTime);
    setFormEndTime(event.endTime);
    setFormTag(event.tag);
    setFormDescription(event.description || "");
    setFormRepeat(event.repeat || "none");
  };

  // Create or Update form submission handler
  const handleSaveForm = async (e: FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      triggerToast("Please provide an event title.");
      return;
    }

    if (!formStartTime || !formEndTime) {
      triggerToast("Please input both start and end times.");
      return;
    }

    const parseTime = (timeStr: string): number => {
      const [h, m] = timeStr.split(":").map(Number);
      return (h || 0) * 60 + (m || 0);
    };

    if (parseTime(formStartTime) >= parseTime(formEndTime)) {
      triggerToast("Invalid Time Block: End time must be after start time (24-hour format).");
      return;
    }

    if (editEventId) {
      // Apply updates to existing event
      const updated = events.map(ev => {
        if (ev.id === editEventId) {
          return {
            ...ev,
            title: formTitle.trim(),
            date: selectedDayString,
            startTime: formStartTime,
            endTime: formEndTime,
            tag: formTag,
            description: formDescription.trim(),
            repeat: formRepeat
          };
        }
        return ev;
      });
      await syncWithServer(updated);
      triggerToast(`Saved updates for "${formTitle.trim()}"`);
    } else {
      // Schedule fresh new event
      const newEvent: CalendarEvent = {
        id: `ev-${Date.now()}`,
        title: formTitle.trim(),
        date: selectedDayString,
        startTime: formStartTime,
        endTime: formEndTime,
        tag: formTag,
        description: formDescription.trim(),
        repeat: formRepeat
      };
      const updated = [...events, newEvent];
      await syncWithServer(updated);
      triggerToast(`"${formTitle.trim()}" added to your schedule.`);
    }

    handleResetForm();
  };

  const renderNavigationControls = (isHeader: boolean) => {
    return (
      <div className={`flex items-center gap-2 rounded-xl p-1 border transition-colors ${
        theme === "dark"
          ? "bg-slate-800 border-slate-705 text-slate-100"
          : "bg-slate-100 border-slate-200 text-slate-800"
      } ${isHeader ? "hidden lg:flex" : "flex lg:hidden w-full max-w-sm justify-between shadow-xs"}`}>
        <button
          onClick={handlePrevMonth}
          className={`p-1 rounded-lg transition-all cursor-pointer ${
            theme === "dark" ? "hover:bg-slate-700 text-slate-400 hover:text-white" : "hover:bg-white text-slate-600 hover:text-slate-950"
          }`}
          title="Previous Month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs font-bold px-2 min-w-[105px] text-center select-none font-sans">
          {MONTHS[monthIdx]} {year}
        </span>
        <button
          onClick={handleNextMonth}
          className={`p-1 rounded-lg transition-all cursor-pointer ${
            theme === "dark" ? "hover:bg-slate-700 text-slate-400 hover:text-white" : "hover:bg-white text-slate-600 hover:text-slate-950"
          }`}
          title="Next Month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <div className={`w-[1px] h-4 mx-0.5 ${theme === "dark" ? "bg-slate-700" : "bg-slate-250"}`}></div>
        <button
          onClick={handleGoToday}
          className={`text-[10px] uppercase font-mono tracking-wider font-bold px-2 py-0.5 rounded-md shadow-xs transition-all cursor-pointer ${
            theme === "dark" ? "bg-slate-700 hover:bg-slate-600 text-slate-205" : "bg-white hover:bg-slate-50 text-slate-700"
          }`}
        >
          Today
        </button>
      </div>
    );
  };

  // ------------------------------------------------------------
  // AUTHENTICATION SCREEN DESIGN
  // ------------------------------------------------------------
  if (!userToken || !username) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 md:p-6 font-sans antialiased relative overflow-hidden">
        {/* Subtle background glow mimicking the pink/purple/indigo brand logo */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-tr from-indigo-500/10 via-purple-500/10 to-pink-500/10 rounded-full blur-[100px] pointer-events-none select-none" />
        
        {/* Top Graphic Accent Line matching logo colors */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 select-none z-50 shrink-0" />

        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-slate-800 text-white text-xs px-4 py-3 rounded-xl shadow-xl border border-slate-700 flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        <div className="max-w-md w-full bg-slate-800/80 backdrop-blur-md rounded-3xl border border-slate-700/60 p-6 md:p-8 shadow-2xl space-y-6 relative z-10">
          <div className="text-center space-y-2">
            <div className="mx-auto w-14 h-14 rounded-2xl overflow-hidden shadow-lg border border-slate-700">
              <img
                src="/dopical_logo_1781802501410.jpg"
                alt="Dopical Logo"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white select-none">Dopical</h1>
            <p className="text-xs text-slate-400">Save, organize and synchronize your routines privately with single-point accounts.</p>
          </div>

          {/* Login / Register Toggle */}
          <div className="grid grid-cols-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => {
                setAuthMode("login");
                setAuthError(null);
              }}
              className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all text-center cursor-pointer ${
                authMode === "login"
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              Sign In
            </button>
            <button
              onClick={() => {
                setAuthMode("register");
                setAuthError(null);
              }}
              className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all text-center cursor-pointer ${
                authMode === "register"
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Register
            </button>
          </div>

          {authError && (
            <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl flex gap-2 text-rose-300 text-xs items-center">
              <span className="shrink-0">⚠️</span>
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={authMode === "login" ? handleLoginSubmit : handleRegisterSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-mono tracking-wider font-bold text-slate-400 uppercase block">Username</label>
              <input
                type="text"
                required
                placeholder="e.g. janesmith"
                value={authUsername}
                onChange={(e) => setAuthUsername(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 focus:border-purple-500 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500/30 transition-all"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono tracking-wider font-bold text-slate-400 uppercase block">Password</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 focus:border-purple-500 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500/30 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 hover:shadow-lg hover:shadow-purple-500/10 text-white font-bold py-3 rounded-xl cursor-pointer text-xs transition-all flex items-center justify-center gap-2 select-none h-11"
            >
              {authLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : authMode === "login" ? (
                <>
                  <LogIn className="w-4 h-4 shrink-0" />
                  Sign In Access
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 shrink-0" />
                  Create Calendar Account
                </>
              )}
            </button>
          </form>

          <div className="text-center">
            <span className="text-[10px] text-slate-500 font-mono">
              ⚡ Sandbox isolation guarantees your personal database logs remain secure.
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------
  // MAIN WORKSPACE INTERFACE (REWRITTEN 3-COLUMN LAYOUT)
  // ------------------------------------------------------------
  return (
    <div className={`min-h-screen flex flex-col font-sans antialiased transition-colors duration-200 ${
      theme === "dark" 
        ? "bg-slate-950 text-slate-100 selection:bg-purple-900/30" 
        : "bg-slate-50 text-slate-800 selection:bg-purple-100"
    }`}>
      {/* Top Graphic Accent Line matching logo colors */}
      <div className="h-[3px] w-full bg-gradient-to-r from-indigo-505 via-purple-500 to-pink-505 select-none shrink-0" />
      
      {/* Universal Toast Notifications */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs px-4 py-3 rounded-xl shadow-xl border border-slate-700 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Panel */}
      <header className={`border-b sticky top-0 z-30 shadow-xs transition-colors duration-200 py-3.5 px-6 ${
        theme === "dark" ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-850"
      }`}>
        <div className="max-w-[1750px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          {/* Brand Logo & Active User Details */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg overflow-hidden shadow flex items-center justify-center select-none border border-slate-700/15">
              <img
                src="/dopical_logo_1781802501410.jpg"
                alt="Dopical Logo"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className={`text-sm font-bold tracking-tight select-none ${
                  theme === "dark" ? "text-white" : "text-slate-900"
                }`}>
                  Dopical
                </h1>
                {syncing && (
                  <span className="inline-flex items-center gap-1 text-[9px] bg-indigo-550 text-white border border-indigo-500 px-1.5 py-0.2 rounded font-mono font-bold animate-pulse">
                    Saving...
                  </span>
                )}
              </div>
              <p className={`text-[10px] ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                User: <span className={`font-semibold font-mono ${theme === "dark" ? "text-indigo-305" : "text-slate-800"}`}>@{username}</span>
              </p>
            </div>
          </div>

          {/* Centralized Cal Month Navigation Controls (Hidden on mobile inside header) */}
          {renderNavigationControls(true)}

          {/* Theme Switcher, Quick Clear & Sign Out Options */}
          <div className="flex items-center gap-1.5 text-xs">
            {/* Elegant Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className={`p-1.5 px-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-1.5 text-[11px] font-semibold ${
                theme === "dark"
                  ? "bg-slate-800 text-yellow-400 border-slate-700 hover:bg-slate-700"
                  : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
              }`}
              title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
            >
              {theme === "light" ? (
                <>
                  <Moon className="w-3.5 h-3.5" />
                  <span className="hidden leading-none sm:inline">Dark</span>
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5 text-yellow-400" />
                  <span className="hidden leading-none sm:inline">Light</span>
                </>
              )}
            </button>

            <button 
              onClick={handleClearAllEvents}
              className={`font-medium px-2.5 py-1.5 rounded-lg border border-transparent transition-all cursor-pointer flex items-center gap-1 ${
                theme === "dark"
                  ? "hover:bg-rose-950/40 text-rose-400 hover:border-rose-900/40"
                  : "hover:bg-rose-50 text-rose-600 hover:border-rose-100"
              }`}
              title="Reset Database"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
              <span className="hidden leading-none md:inline text-[11px]">Clear Calendar</span>
            </button>

            <button 
              onClick={() => setIsSettingsOpen(true)}
              className={`px-2.5 py-1.5 rounded-lg border transition-all font-semibold flex items-center gap-1 text-[11px] cursor-pointer ${
                theme === "dark"
                  ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
                  : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
              }`}
              title="Settings & GDPR Privacy Guard"
            >
              <Settings className="w-3.5 h-3.5 text-indigo-500" />
              <span className="hidden sm:inline leading-none">Settings & Privacy</span>
            </button>

            <button 
              onClick={handleLogout}
              className={`px-3 py-1.5 rounded-lg border transition-all font-semibold flex items-center gap-1 text-[11px] cursor-pointer ${
                theme === "dark"
                  ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
                  : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
              }`}
            >
              <LogOut className="w-3.5 h-3.5 text-slate-500" />
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* 3-Column Work Bench Dashboard */}
      <main className="flex-1 max-w-[1750px] w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch lg:overflow-hidden overflow-y-auto pretty-scroll">
        
        {/* ======================================================== */}
        {/* SIDEBAR ON THE LEFT: TABBED AGENDA & FRIENDS SHARING     */}
        {/* ======================================================== */}
        <section className={`lg:col-span-3 flex flex-col border rounded-2xl shadow-xs overflow-hidden h-[calc(100vh-130px)] lg:h-auto min-h-[400px] transition-colors duration-200 ${
          theme === "dark" ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-800"
        }`}>
          {/* Header Tab Switchers */}
          <div className={`grid grid-cols-2 p-1 border-b text-center shrink-0 ${
            theme === "dark" ? "border-slate-800 bg-slate-950/20" : "border-slate-150 bg-slate-50/50"
          }`}>
            <button
              onClick={() => setLeftSidebarTab("agenda")}
              className={`py-2 text-[11px] font-bold rounded-xl transition-all cursor-pointer ${
                leftSidebarTab === "agenda"
                  ? theme === "dark"
                    ? "bg-slate-800 text-indigo-400 font-extrabold shadow-sm"
                    : "bg-white text-indigo-700 font-extrabold shadow-xs"
                  : "text-slate-400 hover:text-slate-500"
              }`}
            >
              🗓️ Agenda
            </button>
            <button
              onClick={() => setLeftSidebarTab("sharing")}
              className={`py-2 text-[11px] font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 ${
                leftSidebarTab === "sharing"
                  ? theme === "dark"
                    ? "bg-slate-800 text-purple-400 font-extrabold shadow-sm"
                    : "bg-white text-purple-700 font-extrabold shadow-xs"
                  : "text-slate-400 hover:text-slate-500"
              }`}
            >
              👥 Friends & Sharing
              {userProfile?.incomingRequests && userProfile.incomingRequests.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
              )}
            </button>
          </div>

          {/* Tab Viewport */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 pretty-scroll">
            {leftSidebarTab === "agenda" ? (
              <div className="space-y-3">
                {upcomingEventsChronological.length === 0 ? (
                  <div className="text-center py-12 px-3">
                    <span className="text-2xl select-none">☕</span>
                    <p className={`text-xs font-semibold mt-2 ${theme === "dark" ? "text-slate-300" : "text-slate-600"}`}>All caught up!</p>
                    <p className="text-[10.5px] text-slate-400 mt-1 leading-normal">
                      Select any cell in the calendar grid and use the right side panel to schedule events.
                    </p>
                  </div>
                ) : (
                  upcomingEventsChronological.map((item, id) => {
                    const tagObj = TAG_CONFIG[item.tag] || TAG_CONFIG.socials;
                    const isSelectedDayItem = item.date === selectedDayString;
                    const isFriendEvent = !!item.friendOwner;
                    
                    // Format event date nicely (e.g. Jun 19)
                    const dateParts = item.date.split("-");
                    const dayObj = new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2]));
                    const displayDateStr = dayObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                    const weekdayStr = dayObj.toLocaleDateString("en-US", { weekday: "short" });

                    return (
                      <div
                        key={`${item.id}-${item.date}-${id}`}
                        onClick={() => {
                          if (!isFriendEvent) {
                            setSelectedDayString(item.date);
                            handleInitiateEdit(item);
                          } else {
                            setSelectedDayString(item.date);
                            triggerToast(`Viewing shared event from @${item.friendOwner}`);
                          }
                        }}
                        className={`p-3 rounded-xl border transition-all text-left cursor-pointer flex gap-2.5 items-start relative group hover:-translate-y-px ${
                          isFriendEvent
                            ? theme === "dark"
                              ? "bg-purple-950/10 border-purple-900/40 hover:border-purple-800"
                              : "bg-purple-50/30 border-purple-100 hover:border-purple-200"
                            : isSelectedDayItem 
                              ? theme === "dark"
                                ? "bg-slate-800 border-indigo-500 shadow-sm"
                                : "bg-slate-50 border-indigo-400 shadow-xs" 
                              : theme === "dark"
                                ? "bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-850/50"
                                : "bg-white border-slate-150 hover:border-slate-250 hover:bg-slate-50/30"
                        }`}
                      >
                        {/* Compact Date Marker */}
                        <div className={`flex flex-col items-center justify-center text-center rounded-lg px-2 py-1 shrink-0 select-none ${
                            theme === "dark" ? "bg-slate-805 text-slate-300" : "bg-slate-100 text-slate-705"
                        }`}>
                          <span className={`text-[8px] uppercase tracking-wider font-mono font-bold ${theme === "dark" ? "text-slate-405" : "text-slate-500"}`}>{weekdayStr}</span>
                          <span className={`text-xs font-bold ${theme === "dark" ? "text-white" : "text-slate-800"}`}>{displayDateStr}</span>
                        </div>

                        {/* Content Block */}
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`w-1.5 h-1.5 rounded-full ${isFriendEvent ? "bg-purple-500" : tagObj.marker}`}></span>
                            <h4 className={`font-bold text-xs truncate leading-normal ${theme === "dark" ? "text-white" : "text-slate-900"}`} title={item.title}>
                              {isFriendEvent && <span className="text-purple-500 font-mono text-[10px] mr-1">[@{item.friendOwner}]</span>}
                              {item.title}
                            </h4>
                          </div>

                          <div className={`flex items-center gap-2 text-[10px] font-mono ${theme === "dark" ? "text-slate-400" : "text-slate-505"}`}>
                            <span>{item.startTime} - {item.endTime}</span>
                            {item.repeat && item.repeat !== "none" && (
                              <span className="text-[10px] text-amber-500 flex items-center gap-0.5 font-bold" title={`Repeats ${item.repeat}`}>
                                🔄
                              </span>
                            )}
                          </div>

                          {item.description && (
                            <p className={`text-[10.5px] line-clamp-1 leading-normal ${theme === "dark" ? "text-slate-405" : "text-slate-500"}`}>
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              /* SHARING CENTER VIEWPORT */
              <div className="space-y-4">
                
                {/* A. REQUEST ACCESS OVERLAY */}
                <div className={`p-3 rounded-xl border ${
                  theme === "dark" ? "bg-slate-950/40 border-slate-800" : "bg-slate-50/50 border-slate-150"
                }`}>
                  <h4 className={`font-bold text-[11px] tracking-tight uppercase font-mono ${theme === "dark" ? "text-purple-400" : "text-purple-700"}`}>
                    Request Access
                  </h4>
                  <p className="text-[10px] text-slate-400 leading-normal mb-2.5">
                    Ask another user permission to overlay their calendar.
                  </p>
                  
                  <form onSubmit={handleSendRequestSubmit} className="flex gap-1.5">
                    <div className="relative flex-1">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-mono">@</span>
                      <input
                        type="text"
                        value={friendSearchName}
                        onChange={(e) => setFriendSearchName(e.target.value)}
                        placeholder="username"
                        className={`w-full text-xs pl-6 pr-2 py-1.5 rounded-lg border font-mono transition-all ${
                          theme === "dark"
                            ? "bg-slate-900 border-slate-700 text-white focus:border-purple-500 outline-none"
                            : "bg-white border-slate-200 text-slate-800 focus:border-purple-500 outline-none"
                        }`}
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 transition-colors text-white font-semibold rounded-lg text-xs cursor-pointer select-none"
                    >
                      Request
                    </button>
                  </form>

                  {friendSearchError && (
                    <p className="text-[10px] text-rose-500 font-mono mt-1.5 leading-normal">{friendSearchError}</p>
                  )}
                  {friendSearchSuccess && (
                    <p className="text-[10px] text-emerald-500 font-mono mt-1.5 leading-normal">{friendSearchSuccess}</p>
                  )}
                </div>

                {/* B. INCOMING REQUESTS notifications */}
                <div className="space-y-2">
                  <h4 className={`font-bold text-[11px] uppercase tracking-wider font-mono ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                    Incoming Requests ({userProfile?.incomingRequests?.length || 0})
                  </h4>
                  
                  {!userProfile?.incomingRequests || userProfile.incomingRequests.length === 0 ? (
                    <p className="text-[10.5px] text-slate-400 italic">No pending viewing requests.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {userProfile.incomingRequests.map((reqUser) => (
                        <div
                          key={reqUser}
                          className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 ${
                            theme === "dark" ? "bg-slate-850/50 border-slate-800" : "bg-slate-50 border-slate-150"
                          }`}
                        >
                          <span className="font-mono text-xs text-indigo-400 font-bold truncate">@{reqUser}</span>
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => handleRespondRequest(reqUser, true)}
                              className="p-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors cursor-pointer"
                              title="Approve access"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleRespondRequest(reqUser, false)}
                              className="p-1 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer"
                              title="Decline request"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* C. SHARED CALENDARS AVAILABLE TO OVERLAY */}
                <div className="space-y-2 pt-1 border-t border-slate-700/15">
                  <h4 className={`font-bold text-[11px] uppercase tracking-wider font-mono ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                    Friend Calendars (Overlay / Gaps)
                  </h4>
                  <p className="text-[10px] text-slate-400 leading-normal">
                    Toggle checkmarks to view timetables side-by-side or spot mutual schedule gaps.
                  </p>
                  
                  {!userProfile?.canView || userProfile.canView.length === 0 ? (
                    <p className="text-[10.5px] text-slate-400 italic">You don't have access to any external calendars yet. Request access above!</p>
                  ) : (
                    <div className="space-y-1.5">
                      {userProfile.canView.map((friend) => {
                        const isChecked = activeCompareFriends.includes(friend);
                        return (
                          <label
                            key={friend}
                            className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition-colors ${
                              isChecked
                                ? theme === "dark"
                                  ? "bg-purple-950/20 border-purple-800/60"
                                  : "bg-purple-50/50 border-purple-200"
                                : theme === "dark"
                                  ? "bg-slate-850/30 border-slate-800 hover:bg-slate-800/40"
                                  : "bg-white border-slate-150 hover:bg-slate-50/50"
                            }`}
                          >
                            <span className="font-mono text-xs font-semibold">@{friend}</span>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleCompareFriend(friend)}
                              className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                            />
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* D. THE EXQUISITE MUTUAL GAPS FINDER PANEL */}
                {activeCompareFriends.length > 0 && (
                  <div className={`p-3 rounded-xl border space-y-2 shrink-0 ${
                    theme === "dark" ? "bg-teal-950/15 border-teal-900/40" : "bg-teal-50/40 border-teal-100"
                  }`}>
                    <div className="flex items-center gap-1.5">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
                      </span>
                      <h4 className={`font-bold text-[10.5px] tracking-tight uppercase font-mono ${theme === "dark" ? "text-teal-400" : "text-teal-700"}`}>
                        Mutual Free Gaps Finder
                      </h4>
                    </div>
                    <p className="text-[9.5px] text-slate-400 font-mono">
                      Comparing slot blocks for: <span className="text-amber-500">@{activeCompareFriends.join(", @")}</span>
                    </p>

                    <div>
                      {mutualFreeGaps.length === 0 ? (
                        <p className="text-[10px] text-rose-400 italic">No mutual gaps found on this selected day (08:00 - 21:00).</p>
                      ) : (
                        <div className="space-y-1">
                          <p className="text-[10px] text-slate-400 font-mono">🔍 Standard mutual free times gaps:</p>
                          <div className="flex flex-wrap gap-1">
                            {mutualFreeGaps.map((slot, idx) => (
                              <span
                                key={idx}
                                className={`text-[9.5px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                                  theme === "dark" ? "bg-teal-900/35 text-teal-300" : "bg-teal-50 text-teal-700 border border-teal-200/50"
                                }`}
                              >
                                {slot}
                              </span>
                            ))}
                          </div>
                          <p className="text-[9px] text-teal-500 italic mt-1 leading-tight">💡 Great! You can schedule meetings during these slots.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* E. PEOPLE WHO VIEW YOU */}
                <div className="space-y-2 pt-1.5 border-t border-slate-700/15">
                  <h4 className={`font-bold text-[11px] uppercase tracking-wider font-mono ${theme === "dark" ? "text-slate-400" : "text-slate-505"}`}>
                    People permitted to view you
                  </h4>
                  
                  {!userProfile?.sharedWith || userProfile.sharedWith.length === 0 ? (
                    <p className="text-[10.5px] text-slate-400 italic">You aren't sharing with anyone yet.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {userProfile.sharedWith.map((viewer) => (
                        <div
                          key={viewer}
                          className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 ${
                            theme === "dark" ? "bg-slate-850/50 border-slate-800" : "bg-slate-50 border-slate-150"
                          }`}
                        >
                          <span className="font-mono text-xs font-semibold">@{viewer}</span>
                          <button
                            onClick={() => handleRevokePermission(viewer)}
                            className="text-[10px] px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 transition-colors font-mono rounded cursor-pointer"
                          >
                            Revoke
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>

          {/* Copy Paste Spread Sheet Helper Area */}
          <div className={`p-4 border-t text-center shrink-0 ${
            theme === "dark" ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-150"
          }`}>
            <button 
              onClick={() => {
                const jsonStr = JSON.stringify(events, null, 2);
                navigator.clipboard.writeText(jsonStr);
                triggerToast("Structured calendar backup JSON copied");
              }}
              className={`w-full text-[10.5px] border py-2.5 rounded-lg font-mono font-bold transition-all shadow-sm flex items-center justify-center gap-1 cursor-pointer ${
                theme === "dark" 
                  ? "bg-slate-805 hover:bg-slate-700 text-slate-200 border-slate-700" 
                  : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
              Export Backup JSON
            </button>
          </div>
        </section>

        {/* ======================================================== */}
        {/* CENTER AREA (MIDDLE): MAIN INTERACTIVE CALENDAR BOARD     */}
        {/* ======================================================== */}
        <section className={`lg:col-span-6 flex flex-col border rounded-2xl shadow-xs overflow-hidden h-[calc(100vh-130px)] lg:h-auto select-none transition-colors duration-200 ${
          theme === "dark" ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-800"
        }`}>
          
          {/* Mobile Navigation Controls: ONLY VISIBLE below lg screen size (TODAY etc) */}
          <div className={`lg:hidden p-3 border-b flex items-center justify-center transition-colors duration-200 ${
            theme === "dark" ? "bg-slate-900 border-slate-800" : "bg-slate-50/50 border-slate-150"
          }`}>
            {renderNavigationControls(false)}
          </div>

          {/* Calendar Table wrapper with scrollbars to protect shorter viewpoints and narrow screens */}
          <div className="flex-1 overflow-y-auto overflow-x-auto pretty-scroll">
            <div className="min-w-[620px] lg:min-w-0 flex flex-col h-full">
              
              {/* Calendar Weekday Names */}
              <div className={`grid grid-cols-7 border-b py-2.5 text-center text-[10.5px] font-mono font-bold shrink-0 ${
                theme === "dark" ? "border-slate-800 bg-slate-900/60 text-slate-400" : "border-slate-200 bg-slate-50 text-slate-500"
              }`}>
                {DAYS_OF_WEEK.map(day => (
                  <div key={day} className="tracking-wider uppercase">{day}</div>
                ))}
              </div>

              {/* 42 block days table */}
              <div className={`grid-1 flex-1 grid grid-cols-7 grid-rows-6 divide-x divide-y ${
                theme === "dark" ? "divide-slate-800 bg-slate-950/40" : "divide-slate-100 bg-slate-100/50"
              }`}>
                {calendarCells.map((cell, idx) => {
                  const isSelected = selectedDayString === cell.dateString;
                  const cellEvents = eventsByDate[cell.dateString] || [];
                  
                  return (
                    <div
                      key={`${cell.dateString}-${idx}`}
                      onClick={() => setSelectedDayString(cell.dateString)}
                      className={`p-2 transition-all flex flex-col justify-between group relative cursor-pointer min-h-[75px] md:min-h-[100px] ${
                        !cell.isCurrentMonth
                          ? theme === "dark" ? "bg-slate-950/20 text-slate-600" : "bg-slate-50/50 text-slate-400"
                          : theme === "dark" ? "bg-slate-900" : "bg-white"
                      } ${
                        isSelected
                          ? theme === "dark" ? "ring-2 ring-purple-500 z-10 bg-purple-950/20" : "ring-2 ring-purple-500 z-10 bg-purple-50/15"
                          : theme === "dark" ? "hover:bg-slate-850" : "hover:bg-slate-50/50"
                      }`}
                    >
                      
                      {/* Hover Quick Add Plus Button */}
                      <button
                        onClick={(e) => handleQuickAddEvent(e, cell.dateString)}
                        className={`absolute top-1.5 right-1.5 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-all duration-150 shadow-xs flex items-center justify-center border z-20 ${
                          theme === "dark"
                            ? "bg-purple-950/90 border-purple-850 text-purple-300 hover:bg-purple-900 hover:border-purple-700"
                            : "bg-purple-50 border-purple-200 text-purple-650 hover:bg-purple-100 hover:border-purple-300"
                        }`}
                        title="Add Event to Timetable"
                      >
                        <Plus className="w-3 h-3 md:w-3.5 md:h-3.5" />
                      </button>
                      
                      {/* Calendar day digit and tiny indicator mark */}
                      <div className="flex justify-between items-center">
                        <span 
                          className={`text-xs font-mono font-bold flex items-center justify-center w-5.5 h-5.5 rounded-full select-none ${
                            cell.isToday 
                              ? "bg-gradient-to-br from-indigo-500 via-purple-605 to-pink-500 text-white font-extrabold shadow-sm" 
                              : isSelected 
                                ? theme === "dark" ? "text-purple-405 font-extrabold" : "text-purple-605 font-extrabold"
                                : theme === "dark" ? "text-slate-305" : "text-slate-805"
                          } ${!cell.isCurrentMonth && !cell.isToday ? "opacity-45" : ""}`}
                        >
                          {cell.dayOfMonth}
                        </span>

                        {/* Simple indicator dot for count */}
                        {cellEvents.length > 0 && (
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${theme === "dark" ? "bg-slate-600" : "bg-slate-400"}`}></span>
                        )}
                      </div>

                      {/* Cell Category Highlight Pills (Highly Customized for different categories) */}
                      <div className="flex-1 mt-1.5 space-y-1 overflow-y-auto max-h-[50px] md:max-h-[75px] pretty-scroll select-none">
                        {cellEvents.map((ev, evIdx) => {
                          const styles = getTagStyles(ev.tag, theme === "dark");
                          return (
                            <div
                              key={`${ev.id}-${evIdx}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDayString(cell.dateString);
                                handleInitiateEdit(ev);
                              }}
                              className={`text-[9px] font-semibold tracking-tight px-1 py-0.5 rounded-md border-l-2 truncate transition-all overflow-hidden ${styles.bg} ${styles.border} ${styles.text} hover:scale-[1.02] flex items-center justify-between gap-0.5`}
                              title={`${ev.title} (${ev.startTime} - ${ev.endTime})`}
                            >
                              <span className="truncate">
                                <strong className="mr-0.5 font-bold font-mono opacity-80">{ev.startTime}</strong> {ev.title}
                              </span>
                              {ev.repeat && ev.repeat !== "none" && (
                                <span className="text-[8px] font-sans scale-90 opacity-85">🔄</span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                    </div>
                  );
                })}
              </div>

            </div>
          </div>

          {/* Simple Bottom Tip */}
          <div className={`p-2 border-t text-center text-[10px] select-none transition-colors duration-200 ${
            theme === "dark" ? "border-slate-800 bg-slate-950/60 text-slate-500" : "border-slate-100 bg-slate-50 text-slate-400"
          }`}>
            💡 Selection Focus is synchronized. Click a cell to view and arrange today's slots inside the right panel.
          </div>

        </section>

        {/* ======================================================== */}
        {/* SIDEBAR ON THE RIGHT: ADD/REMOVE & ACTIVE DETAILS        */}
        {/* ======================================================== */}
        <section className={`lg:col-span-3 flex flex-col border rounded-2xl shadow-xs overflow-hidden h-[calc(100vh-130px)] lg:h-auto min-h-[450px] transition-colors duration-200 ${
          theme === "dark" ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-800"
        }`}>
          
          {/* Selected Date Header and Context Description */}
          <div className={`p-4 border-b flex items-center justify-between transition-colors duration-200 ${
            theme === "dark" ? "border-slate-800 bg-slate-900/40" : "border-slate-105 bg-slate-50/50"
          }`}>
            <div>
              <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-full font-bold select-none ${
                theme === "dark" ? "bg-indigo-950/50 text-indigo-300 border border-indigo-900/20" : "bg-indigo-50 text-indigo-700"
              }`}>
                Control Station
              </span>
              <h3 className={`font-bold text-xs tracking-tight mt-1 leading-normal ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
                Details: {selectedDayFormatted}
              </h3>
            </div>
          </div>

          {/* Content panel */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 pretty-scroll">
            
            {/* List of items scheduled on the Selected Day (with view mode selector) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 pb-0.5">
                <h4 className={`text-[10px] font-mono font-bold uppercase tracking-wider select-none ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`}>
                  Schedules for this day
                </h4>
                
                {/* Visual View Selector tabs */}
                <div className={`flex items-center p-0.5 rounded-lg border text-[9.5px] font-bold select-none shrink-0 ${
                  theme === "dark" ? "bg-slate-950 border-slate-800" : "bg-slate-100 border-slate-200"
                }`}>
                  <button
                    type="button"
                    onClick={() => setSidebarViewMode("timeline")}
                    className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                      sidebarViewMode === "timeline"
                        ? theme === "dark"
                          ? "bg-indigo-600 text-white"
                          : "bg-white text-indigo-750 shadow-xs border border-slate-200/50"
                        : "text-slate-400 hover:text-slate-300"
                    }`}
                  >
                    Timeline
                  </button>
                  <button
                    type="button"
                    onClick={() => setSidebarViewMode("list")}
                    className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                      sidebarViewMode === "list"
                        ? theme === "dark"
                          ? "bg-indigo-600 text-white"
                          : "bg-white text-indigo-750 shadow-xs border border-slate-200/50"
                        : "text-slate-400 hover:text-slate-300"
                    }`}
                  >
                    Cards
                  </button>
                </div>
              </div>

              {sidebarViewMode === "timeline" ? (
                /* Dynamic Real-Time Visual 24-Hour Timetable scale */
                <div>
                  {(eventsByDate[selectedDayString] || []).length === 0 ? (
                    <div className={`py-6 px-3 border border-dashed rounded-xl text-center ${
                      theme === "dark" ? "bg-slate-950/30 border-slate-805" : "bg-slate-50 border-slate-200"
                    }`}>
                      <p className={`text-[11px] ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>No events scheduled.</p>
                      <p className="text-[9.5px] text-slate-550 mt-0.5">Fill out the quick form below to schedule yours!</p>
                    </div>
                  ) : (
                    <div 
                      ref={scrollContainerRef}
                      className={`relative h-[310px] overflow-y-auto border rounded-xl pretty-scroll transition-colors ${
                        theme === "dark" ? "bg-slate-955 border-slate-805" : "bg-slate-50/50 border-slate-200"
                      }`}
                    >
                      <div className="relative" style={{ height: "1080px" }}>
                        {/* 24-hourly background slot tracks */}
                        {Array.from({ length: 24 }).map((_, hr) => (
                          <div
                            key={hr}
                            style={{ top: `${hr * 45}px`, height: "45px" }}
                            className={`absolute left-0 right-0 border-b flex items-start pt-1 pl-2.5 select-none pointer-events-none ${
                              theme === "dark" ? "border-slate-850/40" : "border-slate-150/40"
                            }`}
                          >
                            <span className={`text-[8.5px] font-mono leading-none font-bold ${theme === "dark" ? "text-slate-600" : "text-slate-400"}`}>
                              {String(hr).padStart(2, "0")}:00
                            </span>
                          </div>
                        ))}

                        {/* Positioned Event Blocks */}
                        {(eventsByDate[selectedDayString] || []).map((ev, evIdx) => {
                          const tagObj = TAG_CONFIG[ev.tag] || TAG_CONFIG.socials;
                          const tagStyles = getTagStyles(ev.tag, theme === "dark");
                          
                          // Helper internal parser
                          const parseTimeToMin = (t: string) => {
                            const [h, m] = t.split(":").map(Number);
                            return (h || 0) * 60 + (m || 0);
                          };

                          const startMin = parseTimeToMin(ev.startTime);
                          const endMin = parseTimeToMin(ev.endTime);
                          const dur = Math.max(30, endMin - startMin); // minimum slot spacing

                          const topPx = (startMin * 45) / 60;
                          const heightPx = (dur * 45) / 60;
                          const isCurrentlySelectedForEdit = editEventId === ev.id;
                          const IconComp = tagObj.icon;

                          return (
                            <div
                              key={`${ev.id}-timeline-${evIdx}`}
                              onClick={() => handleInitiateEdit(ev)}
                              style={{
                                top: `${topPx + 3}px`,
                                height: `${heightPx - 5}px`,
                              }}
                              className={`absolute left-11 right-2 rounded-xl p-2 border transition-all cursor-pointer overflow-hidden group flex flex-col justify-between ${
                                isCurrentlySelectedForEdit
                                  ? theme === "dark"
                                    ? "bg-slate-850 border-indigo-505 shadow-md z-30 ring-2 ring-indigo-500/30"
                                    : "bg-indigo-50/80 border-indigo-400 shadow-sm z-30 ring-2 ring-indigo-500/20"
                                  : theme === "dark"
                                    ? `${tagStyles.bg} ${tagStyles.border} ${tagStyles.text} hover:opacity-90 hover:brightness-110 shadow-xs z-10 hover:z-25`
                                    : `${tagStyles.bg} ${tagStyles.border} ${tagStyles.text} hover:bg-white hover:shadow-xs shadow-2xs z-10 hover:z-25`
                              }`}
                              title={`${ev.title} (${ev.startTime} - ${ev.endTime})`}
                            >
                              <div className="flex items-start justify-between gap-1 w-full min-w-0">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1 select-none">
                                    <span className="text-[8.5px] font-mono tracking-wider font-extrabold pr-1 opacity-80 select-none">
                                      {ev.startTime} - {ev.endTime}
                                    </span>
                                  </div>
                                  <h5 className="font-extrabold text-[10.5px] tracking-tight leading-normal truncate mt-0.5">
                                    {ev.title}
                                  </h5>
                                </div>

                                {/* Instant Action controls */}
                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-100 shrink-0">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleInitiateCopyEvent(ev);
                                    }}
                                    className={`p-0.5 rounded cursor-pointer transition-colors ${
                                      theme === "dark" ? "hover:bg-slate-800 text-slate-400" : "hover:bg-black/5 text-slate-500"
                                    }`}
                                    title="Copy to multiple dates"
                                  >
                                    <Copy className="w-2.5 h-2.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteEventDirectly(ev.id, ev.title);
                                    }}
                                    className="p-0.5 rounded hover:bg-rose-500/10 text-rose-600 transition-colors cursor-pointer"
                                    title="Delete event"
                                  >
                                    <Trash2 className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              </div>

                              {dur >= 45 && ev.description && (
                                <p className="text-[9px] opacity-80 leading-normal line-clamp-1 mt-0.5 font-sans truncate select-none">
                                  {ev.description}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Original simple stack cards display fallback */
                <div>
                  {(eventsByDate[selectedDayString] || []).length === 0 ? (
                    <div className={`py-5 px-3 border border-dashed rounded-xl text-center ${
                      theme === "dark" ? "bg-slate-950/30 border-slate-805" : "bg-slate-50 border-slate-200"
                    }`}>
                      <p className={`text-[11px] ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>No events scheduled.</p>
                      <p className="text-[9.5px] text-slate-550 mt-0.5">Fill out the quick form below to schedule yours!</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-[310px] overflow-y-auto pretty-scroll">
                      {(eventsByDate[selectedDayString] || []).map((ev, evIdx) => {
                        const tagObj = TAG_CONFIG[ev.tag] || TAG_CONFIG.socials;
                        const tagStyles = getTagStyles(ev.tag, theme === "dark");
                        const isCurrentlySelectedForEdit = editEventId === ev.id;
                        const IconComp = tagObj.icon;

                        return (
                          <div
                            key={`${ev.id}-${evIdx}`}
                            onClick={() => handleInitiateEdit(ev)}
                            className={`p-2.5 rounded-xl border transition-all text-left flex items-start justify-between gap-2.5 cursor-pointer relative group ${
                              isCurrentlySelectedForEdit 
                                ? theme === "dark"
                                  ? "bg-slate-850 border-indigo-500 shadow-sm"
                                  : "bg-indigo-50/40 border-indigo-400 shadow-xs" 
                                : theme === "dark"
                                  ? "bg-slate-900 border-slate-800 hover:bg-slate-850/60"
                                  : "bg-white border-slate-150 hover:bg-slate-50/40"
                            }`}
                          >
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md border text-center select-none ${tagStyles.bg} ${tagStyles.border} ${tagStyles.text}`}>
                                  <IconComp className="w-2.5 h-2.5 shrink-0" />
                                  {tagObj.label}
                                </span>
                                {ev.repeat && ev.repeat !== "none" && (
                                  <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold border px-1.5 py-0.5 rounded-md capitalize font-mono leading-none ${
                                    theme === "dark" ? "bg-amber-950/40 text-amber-300 border-amber-900/30" : "bg-amber-50 text-amber-700 border-amber-150"
                                  }`}>
                                    <Repeat className="w-2 h-2" /> {ev.repeat}
                                  </span>
                                )}
                              </div>

                              <h5 className={`font-bold text-[11px] leading-snug truncate ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
                                {ev.title}
                              </h5>

                              <div className={`flex items-center gap-1 text-[10px] font-mono ${theme === "dark" ? "text-slate-400" : "text-slate-505"}`}>
                                <span>🕒 {ev.startTime} - {ev.endTime}</span>
                              </div>

                              {ev.description && (
                                <p className={`text-[10px] line-clamp-2 leading-relaxed ${theme === "dark" ? "text-slate-405" : "text-slate-500"}`}>
                                  {ev.description}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-1 shrink-0 select-none">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleInitiateCopyEvent(ev);
                                }}
                                className={`p-1 rounded-lg transition-colors cursor-pointer ${
                                  theme === "dark" 
                                    ? "hover:bg-purple-950/50 text-slate-400 hover:text-purple-400" 
                                    : "hover:bg-purple-50 text-slate-400 hover:text-purple-605"
                                }`}
                                title="Copy to multiple dates"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteEventDirectly(ev.id, ev.title);
                                }}
                                className={`p-1 rounded-lg transition-colors cursor-pointer ${
                                  theme === "dark" ? "hover:bg-rose-950/50 text-slate-400 hover:text-rose-450" : "hover:bg-rose-50 text-slate-400 hover:text-rose-600"
                                }`}
                                title="Delete Appointment"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* In-Panel Scheduling Form Block */}
            <div className={`pt-3 border-t space-y-3.5 ${theme === "dark" ? "border-slate-800" : "border-slate-100"}`}>
              <div className="flex items-center justify-between">
                <h4 className={`text-[10px] font-mono font-bold uppercase tracking-wider select-none ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`}>
                  {editEventId ? "Modify Event Details" : "Schedule New Event"}
                </h4>
                {editEventId && (
                  <div className="flex items-center gap-2 select-none">
                    <button
                      type="button"
                      onClick={() => {
                        const activeEvent = events.find(ev => ev.id === editEventId);
                        if (activeEvent) handleInitiateCopyEvent(activeEvent);
                      }}
                      className={`text-[10.5px] font-medium flex items-center gap-1 cursor-pointer transition-colors ${theme === "dark" ? "text-purple-400 hover:text-purple-300" : "text-purple-650 hover:text-purple-800"}`}
                      title="Duplicate this event onto other days"
                    >
                      <Copy className="w-3 h-3" /> Copy to dates
                    </button>
                    <span className="text-slate-600 opacity-40 select-none">|</span>
                    <button
                      type="button"
                      onClick={handleResetForm}
                      className={`text-[10.5px] font-medium cursor-pointer transition-colors ${theme === "dark" ? "text-slate-400 hover:text-indigo-400" : "text-slate-500 hover:text-indigo-600"}`}
                    >
                      Clear Form
                    </button>
                  </div>
                )}
              </div>

              <form onSubmit={handleSaveForm} className="space-y-3">
                {/* Title */}
                <div className="space-y-1">
                  <label className={`text-[9.5px] font-mono font-bold uppercase block select-none ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                    Title *
                  </label>
                  <input
                    id="event-title-input"
                    type="text"
                    required
                    placeholder="e.g. Back squating / Prayer / Sync"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2 text-xs transition-all font-sans focus:outline-none ${
                      theme === "dark"
                        ? "bg-slate-950 border-slate-800 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30"
                        : "bg-slate-50 border-slate-200 text-slate-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/25 focus:bg-white"
                    }`}
                  />
                </div>

                {/* Times Row */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className={`text-[9.5px] font-mono font-bold uppercase block select-none ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                      Start Time
                    </label>
                    <input
                      type="time"
                      required
                      value={formStartTime}
                      onChange={(e) => setFormStartTime(e.target.value)}
                      className={`w-full border rounded-xl px-2 py-1.5 text-xs font-mono focus:outline-none ${
                        theme === "dark"
                          ? "bg-slate-950 border-slate-800 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30"
                          : "bg-slate-50 border-slate-200 text-slate-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/25 focus:bg-white"
                      }`}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className={`text-[9.5px] font-mono font-bold uppercase block select-none ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                      End Time
                    </label>
                    <input
                      type="time"
                      required
                      value={formEndTime}
                      onChange={(e) => setFormEndTime(e.target.value)}
                      className={`w-full border rounded-xl px-2 py-1.5 text-xs font-mono focus:outline-none ${
                        theme === "dark"
                          ? "bg-slate-950 border-slate-800 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30"
                          : "bg-slate-50 border-slate-200 text-slate-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/25 focus:bg-white"
                      }`}
                    />
                  </div>
                </div>

                {/* Highlight Category Pickers */}
                <div className="space-y-1">
                  <label className={`text-[9.5px] font-mono font-bold uppercase block select-none ${theme === "dark" ? "text-slate-400" : "text-slate-505"}`}>
                    Category Highlight *
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 select-none text-[10px]">
                    {(Object.keys(TAG_CONFIG) as CalendarTag[]).map((tagKey) => {
                      const tagVal = TAG_CONFIG[tagKey];
                      const isSelected = formTag === tagKey;
                      const IconLabel = tagVal.icon;
                      const themeTagStyles = getTagStyles(tagKey, theme === "dark");

                      const buttonStyles = isSelected
                        ? `${themeTagStyles.bg} ${themeTagStyles.border} ${themeTagStyles.text} scale-[1.02] border-indigo-400 font-extrabold shadow-xs`
                        : theme === "dark" 
                          ? "bg-slate-955 hover:bg-slate-800 text-slate-400 border-slate-800" 
                          : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-transparent";

                      return (
                        <button
                          type="button"
                          key={tagKey}
                          onClick={() => setFormTag(tagKey)}
                          className={`py-1 rounded-lg border transition-all text-center capitalize cursor-pointer font-bold flex items-center justify-center gap-1 ${buttonStyles}`}
                        >
                          <IconLabel className="w-2.5 h-2.5 shrink-0" />
                          <span className="leading-none">{tagKey}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Recurrence Repeat */}
                <div className="space-y-1">
                  <label className={`text-[9.5px] font-mono font-bold uppercase block select-none ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                    Recurrence Repeat Series
                  </label>
                  <div className="relative">
                    <select
                      value={formRepeat}
                      onChange={(e: any) => setFormRepeat(e.target.value)}
                      className={`w-full border focus:outline-none rounded-xl pl-3 pr-8 py-1.5 text-xs transition-colors cursor-pointer appearance-none ${
                        theme === "dark"
                          ? "bg-slate-950 border-slate-800 text-slate-300 focus:bg-slate-900"
                          : "bg-slate-50 border-slate-200 text-slate-700 focus:bg-white"
                      }`}
                    >
                      <option value="none">One-time occurrence</option>
                      <option value="daily">Daily recurrence series</option>
                      <option value="weekly">Weekly recurrence series</option>
                      <option value="monthly">Monthly recurrence series</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <Repeat className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className={`text-[9.5px] font-mono font-bold uppercase block select-none ${theme === "dark" ? "text-slate-400" : "text-slate-505"}`}>
                    Context / Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Details or references..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-1.5 text-xs focus:outline-none transition-all ${
                      theme === "dark"
                        ? "bg-slate-950 border-slate-800 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30"
                        : "bg-slate-50 border-slate-200 text-slate-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/25 focus:bg-white"
                    }`}
                  />
                </div>

                {/* Action Submit */}
                <button
                  type="submit"
                  disabled={!formTitle.trim()}
                  className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 disabled:from-slate-800 disabled:to-slate-800 disabled:bg-none disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold py-2 rounded-xl transition-all shadow-md hover:shadow-lg hover:shadow-purple-500/10 flex items-center justify-center gap-1 text-xs select-none cursor-pointer"
                >
                  {editEventId ? (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Apply Modifications</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Instantly Schedule</span>
                    </>
                  )}
                </button>
              </form>
            </div>

          </div>

          {/* Clean Small Status indicator */}
          <div className={`p-2 border-t text-center text-[10px] select-none font-mono ${
            theme === "dark" ? "border-slate-800 bg-slate-950/65 text-slate-500" : "border-slate-100 bg-slate-50 text-slate-400"
          }`}>
            🛡️ Individual account workspace isolation
          </div>

        </section>

      </main>

      {/* Styled Clean Footer */}
      <footer className={`border-t mt-auto py-3 text-center text-[10px] select-none ${
        theme === "dark" ? "bg-slate-900 border-slate-800 text-slate-500" : "bg-white border-slate-200 text-slate-400"
      }`}>
        <p className="font-mono tracking-widest uppercase">📅 DOPICAL • DEVELOPER EDITION • 2026</p>
      </footer>

      {copySourceEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
          {/* Overlay background with glass blur effect */}
          <div 
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs transition-opacity cursor-pointer"
            onClick={() => setCopySourceEvent(null)}
          />
          
          <div className={`relative max-w-md w-full max-h-[90vh] overflow-y-auto pretty-scroll rounded-2xl p-5 md:p-6 shadow-2xl space-y-4 border z-10 transition-all ${
            theme === "dark" ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
          }`}>
            
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white shrink-0 shadow-sm">
                  <Copy className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-tight">Copy Event to Multiple Dates</h3>
                  <p className={`text-[10px] ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                    Select days on the calendar to paste this event.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCopySourceEvent(null)}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  theme === "dark" ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-100 text-slate-500"
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Event Preview Badge card */}
            <div className={`p-3 rounded-xl border flex flex-col gap-1 ${
              theme === "dark" ? "bg-slate-950/40 border-slate-800/80" : "bg-slate-50/50 border-slate-150"
            }`}>
              <div className="flex items-center gap-1.5 text-[10px] font-mono select-none">
                <span className={`px-1.5 py-0.5 rounded border font-bold text-[9px] ${getTagStyles(copySourceEvent.tag, theme === "dark").bg} ${getTagStyles(copySourceEvent.tag, theme === "dark").border} ${getTagStyles(copySourceEvent.tag, theme === "dark").text}`}>
                  {copySourceEvent.tag.toUpperCase()}
                </span>
                <span className={theme === "dark" ? "text-slate-400 font-medium" : "text-slate-500 font-medium"}>
                  🕒 {copySourceEvent.startTime} - {copySourceEvent.endTime}
                </span>
              </div>
              <h4 className="text-xs font-bold font-sans mt-1">{copySourceEvent.title}</h4>
              {copySourceEvent.description && (
                <p className={`text-[10px] line-clamp-1 leading-normal ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                  {copySourceEvent.description}
                </p>
              )}
            </div>

            {/* Date Picker Section with Interactive Calendar Month Grid */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className={`text-[10.5px] font-mono font-bold uppercase tracking-wider select-none ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`}>
                  {MONTHS[copyCalDate.getMonth()]} {copyCalDate.getFullYear()}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCopyCalDate(new Date(copyCalDate.getFullYear(), copyCalDate.getMonth() - 1, 1))}
                    className={`p-1 rounded-md border transition-colors cursor-pointer ${
                      theme === "dark" ? "bg-slate-950/40 border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white" : "bg-slate-50 border-slate-205 hover:bg-slate-101 text-slate-600"
                    }`}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCopyCalDate(new Date())}
                    className={`text-[9px] px-1.5 py-0.5 rounded-md border tracking-wide select-none font-medium cursor-pointer ${
                      theme === "dark" ? "bg-slate-950/40 border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white" : "bg-slate-50 border-slate-205 hover:bg-slate-101 text-slate-600"
                    }`}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setCopyCalDate(new Date(copyCalDate.getFullYear(), copyCalDate.getMonth() + 1, 1))}
                    className={`p-1 rounded-md border transition-colors cursor-pointer ${
                      theme === "dark" ? "bg-slate-950/40 border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white" : "bg-slate-50 border-slate-205 hover:bg-slate-101 text-slate-600"
                    }`}
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Grid Header days */}
              <div className="grid grid-cols-7 text-center select-none opacity-60">
                {DAYS_OF_WEEK.map(day => (
                  <span key={day} className="text-[10px] font-bold font-mono py-1">
                    {day[0]}
                  </span>
                ))}
              </div>

              {/* Grid cells representing calendar */}
              <div className={`grid grid-cols-7 gap-1 p-1.5 rounded-xl border ${
                theme === "dark" ? "bg-slate-950/30 border-slate-800" : "bg-slate-50/50 border-slate-150"
              }`}>
                {copyCalendarCells.map((cell, idx) => {
                  const isSelected = copyTargetDates.includes(cell.dateString);
                  const isOriginalEventDay = cell.dateString === copySourceEvent.date;
                  
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        if (isOriginalEventDay) {
                          triggerToast("Event is already scheduled on this day!");
                          return;
                        }
                        handleToggleCopyTargetDate(cell.dateString);
                      }}
                      className={`h-7 md:h-8 rounded-lg relative font-sans text-xs flex flex-col items-center justify-center transition-all cursor-pointer select-none ${
                        isOriginalEventDay
                          ? "bg-slate-700/20 text-slate-500 cursor-not-allowed line-through"
                          : isSelected
                            ? "bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white font-bold shadow-xs scale-[1.02]"
                            : !cell.isCurrentMonth
                              ? theme === "dark" ? "text-slate-600 hover:bg-slate-800/20" : "text-slate-350 hover:bg-slate-100/40"
                              : theme === "dark" ? "text-slate-200 hover:bg-slate-800 hover:text-white" : "text-slate-700 hover:bg-slate-200 hover:text-slate-900"
                      }`}
                      title={isOriginalEventDay ? "Original event day" : cell.dateString}
                    >
                      <span className="leading-none">{cell.dayOfMonth}</span>
                      {isSelected && (
                        <span className="absolute bottom-1 w-1 h-1 rounded-full bg-white select-none pointer-events-none" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected dates indicator count & manual custom input container */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px]">
                <span className={`font-mono font-bold uppercase select-none ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`}>
                  Selected Target Dates ({copyTargetDates.length})
                </span>
                {copyTargetDates.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCopyTargetDates([])}
                    className="text-rose-500 hover:text-rose-400 transition-colors font-medium cursor-pointer"
                  >
                    Clear selections
                  </button>
                )}
              </div>

              {copyTargetDates.length > 0 ? (
                <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto pr-1">
                  {copyTargetDates.map(dateStr => {
                    const dateObj = new Date(dateStr + "T00:00:00");
                    const formatted = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                    return (
                      <span
                        key={dateStr}
                        className={`inline-flex items-center gap-1 text-[9px] font-bold px-2.5 py-0.5 rounded-full border ${
                          theme === "dark"
                            ? "bg-purple-950/40 border-purple-900/30 text-purple-300"
                            : "bg-purple-50 border-purple-150 text-purple-700"
                        }`}
                      >
                        {formatted}
                        <button
                          type="button"
                          onClick={() => handleToggleCopyTargetDate(dateStr)}
                          className="hover:text-rose-500 text-[10px] leading-none ml-0.5 shrink-0"
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className={`text-[10px] leading-relaxed italic ${theme === "dark" ? "text-slate-500" : "text-slate-405"}`}>
                  No target dates selected. Click on the calendar days above or manually insert custom dates.
                </p>
              )}

              {/* Instant Manual Add Date Picker in case calendar month view is not enough */}
              <div className="flex items-center gap-2 pt-1 select-none">
                <input
                  type="date"
                  onChange={(e) => {
                    if (e.target.value) {
                      const val = e.target.value;
                      if (val === copySourceEvent.date) {
                        triggerToast("Event is already scheduled on this day!");
                      } else if (!copyTargetDates.includes(val)) {
                        setCopyTargetDates(prev => [...prev, val]);
                        const parts = val.split('-');
                        setCopyCalDate(new Date(Number(parts[0]), Number(parts[1]) - 1, 1));
                      }
                      e.target.value = "";
                    }
                  }}
                  className={`border rounded-xl px-2.5 py-1 text-xs font-mono focus:outline-none transition-all flex-1 ${
                    theme === "dark"
                      ? "bg-slate-950 border-slate-800 text-white focus:border-purple-500"
                      : "bg-slate-50 border-slate-200 text-slate-800 focus:border-purple-500 focus:bg-white"
                  }`}
                />
                <span className={`text-[10px] font-mono shrink-0 ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`}>
                  Add manual date
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className={`pt-3 border-t flex items-center gap-2 ${
              theme === "dark" ? "border-slate-800" : "border-slate-150"
            }`}>
              <button
                type="button"
                onClick={() => setCopySourceEvent(null)}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                  theme === "dark"
                    ? "bg-slate-950/40 border-slate-800 hover:bg-slate-800 text-slate-350 hover:text-white"
                    : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900"
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCommitDuplicateEvents}
                disabled={copyTargetDates.length === 0}
                className="flex-grow flex-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-400 hover:via-purple-400 hover:to-pink-400 disabled:from-slate-800 disabled:to-slate-800 disabled:bg-none disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold py-2 rounded-xl transition-all shadow-md hover:shadow-lg hover:shadow-purple-500/10 flex items-center justify-center gap-1.5 text-xs select-none cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                Paste to Selected Dates
              </button>
            </div>

          </div>
        </div>
      )}

      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Overlay with subtle blur */}
          <div 
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs transition-opacity cursor-pointer"
            onClick={() => setIsSettingsOpen(false)}
          />
          
          <div className={`relative max-w-lg w-full max-h-[90vh] overflow-y-auto pretty-scroll rounded-2xl p-5 md:p-6 shadow-2xl space-y-5 border z-10 transition-all ${
            theme === "dark" ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
          }`}>
            
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0 select-none">
                  <Settings className="w-4 h-4 text-indigo-505" />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-tight">Settings & Privacy Center</h3>
                  <p className={`text-[10px] ${theme === "dark" ? "text-slate-400" : "text-slate-505"}`}>
                    Manage your account details, privacy settings, and active storage allocations.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  theme === "dark" ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-100 text-slate-505"
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Storage Allocations & Database Quota Safety */}
            <div className={`p-4 rounded-xl border space-y-3 ${
              theme === "dark" ? "bg-slate-950/40 border-slate-800/80" : "bg-slate-50 border-slate-150"
            }`}>
              <h4 className="text-xs font-bold font-sans flex items-center gap-1">
                🛡️ Cloud Storage Allocation
              </h4>
              <div className="space-y-1.5 select-none">
                <div className="flex justify-between items-center text-[11px]">
                  <span className={theme === "dark" ? "text-slate-405 font-medium" : "text-slate-500 font-medium"}>
                    Calendar event slots used
                  </span>
                  <span className="font-mono font-bold text-xs">
                    {events.length} / {isPremium ? "500" : "100"} events
                  </span>
                </div>
                <div className={`w-full h-2 rounded-full overflow-hidden ${theme === "dark" ? "bg-slate-800" : "bg-slate-200"}`}>
                  <div 
                    className="h-full bg-gradient-to-r from-indigo-505 via-purple-550 to-pink-505 transition-all duration-500 rounded-full"
                    style={{ width: `${Math.min(100, (events.length / (isPremium ? 500 : 100)) * 100)}%` }}
                  />
                </div>
                <p className={`text-[9.5px] leading-relaxed ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`}>
                  To prevent database load, ensure blazing-fast synchronization, and respect Firebase Spark free plan limits, we regulate standard account storage to <strong>{isPremium ? "500" : "100"} slots</strong>. Support members receive expanded slots.
                </p>
              </div>
            </div>

            {/* Dopical Support Pledge & Slot Upgrades */}
            <div className={`p-4 rounded-xl border space-y-3 ${
              theme === "dark" ? "bg-purple-950/15 border-purple-900/40" : "bg-purple-50/40 border-purple-100"
            }`}>
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-purple-500 animate-pulse" />
                <h4 className={`font-bold text-xs font-sans ${theme === "dark" ? "text-purple-300" : "text-purple-700"}`}>
                  Dopical Support Pledge & Upgrades
                </h4>
              </div>
              <p className={`text-[10px] leading-relaxed ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>
                Dopical is completely free from paywalls or ads. To keep server bills exactly at zero, standard accounts have 100 event slots. Pledge any support to hosting, then type <code className="font-mono text-amber-500 font-bold">DOPICAL_CHAMPION</code> below to permanently expand your slots to 500!
              </p>
              
              <div className="flex flex-col gap-2">
                <form onSubmit={handleVerifyPremiumCode} className="flex gap-1.5 w-full">
                  <input
                    type="text"
                    value={promoCodeInput}
                    onChange={(e) => setPromoCodeInput(e.target.value)}
                    placeholder="Enter support code (e.g. DOPICAL_CHAMPION)"
                    className={`w-full text-xs px-2.5 py-1.5 rounded-lg border font-mono transition-all ${
                      theme === "dark"
                        ? "bg-slate-900 border-slate-700 text-white focus:border-purple-500 outline-none"
                        : "bg-white border-slate-200 text-slate-850 focus:border-purple-500 outline-none"
                    }`}
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-505 hover:to-indigo-505 text-white text-xs font-bold rounded-lg cursor-pointer whitespace-nowrap"
                  >
                    Verify Code
                  </button>
                </form>
                
                {supportLink && (
                  <a
                    href={supportLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white text-xs font-bold rounded-lg cursor-pointer text-center"
                  >
                    <Heart className="w-3.5 h-3.5 fill-current animate-pulse" />
                    Pledge Direct Support (Opens Your Custom Portal)
                  </a>
                )}
              </div>
              {promoFeedback && (
                <p className={`text-[10px] font-mono leading-relaxed font-semibold ${promoFeedback.startsWith("❌") ? "text-rose-500" : "text-emerald-500"}`}>
                  {promoFeedback}
                </p>
              )}
            </div>

            {/* GDPR & Legal Transparency */}
            <div className={`p-4 rounded-xl border space-y-2.5 ${
              theme === "dark" ? "bg-slate-950/40 border-slate-800/80" : "bg-slate-50 border-slate-150"
            }`}>
              <h4 className="text-xs font-bold font-sans flex items-center gap-1 text-emerald-500">
                <Shield className="w-3.5 h-3.5 mr-0.5" /> GDPR & Privacy Transparency
              </h4>
              <ul className={`list-disc list-inside space-y-1 text-[10.5px] leading-relaxed ${theme === "dark" ? "text-slate-400" : "text-slate-650"}`}>
                <li><strong>Privacy Isolation</strong>: Scheduled events and credentials are tied strictly to your registered account prefix.</li>
                <li><strong>Secure Hashing</strong>: We digest and encrypt authentication codes utilizing industrial SHA-256 web cryptography shields.</li>
                <li><strong>No Commercial Analytics</strong>: Free of advertisement networks, tracking cookies, or payload monetization hooks.</li>
                <li><strong>Zero-Billing Policy</strong>: Runs entirely within fully optimized limits, guaranteeing that your use of Dopical is free forever.</li>
              </ul>
            </div>

            {/* Compliance Tools & Controls Panel */}
            <div className="space-y-3">
              <h4 className={`text-[10px] font-mono font-bold uppercase tracking-wider select-none ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`}>
                GDPR Account Management Tools
              </h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Data Portability (Export JSON) */}
                <div className={`border rounded-xl p-3 flex flex-col justify-between gap-2.5 text-xs ${
                  theme === "dark" ? "bg-slate-950/20 border-slate-800" : "bg-slate-50/50 border-slate-150"
                }`}>
                  <div>
                    <span className="font-bold block">1. Export Calendar Data</span>
                    <span className={`text-[9.5px] block leading-normal mt-0.5 ${theme === "dark" ? "text-slate-400" : "text-slate-550"}`}>
                      Export all active scheduled events into a standardized JSON file.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportEvents}
                    className={`w-full py-1.5 text-[10.5px] font-bold rounded-lg border transition-all cursor-pointer select-none flex items-center justify-center gap-1 ${
                      theme === "dark" 
                        ? "bg-slate-800 border-slate-700 hover:bg-slate-700 text-indigo-300" 
                        : "bg-white border-slate-205 hover:bg-slate-50 text-indigo-600"
                    }`}
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                    Download Backup JSON
                  </button>
                </div>

                {/* Right to be Forgotten (Delete Profile) */}
                <div className={`border rounded-xl p-3 flex flex-col justify-between gap-2.5 text-xs ${
                  theme === "dark" ? "bg-slate-950/20 border-slate-800" : "bg-slate-50/50 border-slate-150"
                }`}>
                  <div>
                    <span className="font-bold block text-rose-505">2. Delete Account Profile</span>
                    <span className={`text-[9.5px] block leading-normal mt-0.5 ${theme === "dark" ? "text-slate-400" : "text-slate-550"}`}>
                      Completely wipe all stored records, credentials, and appointments permanently.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    className={`w-full py-1.5 text-[10.5px] font-bold rounded-lg border transition-all cursor-pointer select-none flex items-center justify-center gap-1 ${
                      theme === "dark" 
                        ? "bg-rose-950/40 border-rose-900/40 hover:bg-rose-900/40 text-rose-300" 
                        : "bg-rose-50 border-rose-100 hover:bg-rose-100 text-rose-700"
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5 shrink-0" />
                    Permanently Erase All Data
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className={`pt-3 border-t flex justify-end gap-2 ${
              theme === "dark" ? "border-slate-800" : "border-slate-150"
            }`}>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className={`py-2 px-5 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                  theme === "dark"
                    ? "bg-slate-950/40 border-slate-800 hover:bg-slate-850 text-slate-350 hover:text-white"
                    : "bg-slate-50 border-slate-205 hover:bg-slate-101 text-slate-600 hover:text-slate-900"
                }`}
              >
                Close Settings
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
