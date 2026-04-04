"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, signOut as firebaseSignOut, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

type UserProfile = {
  role: "superuser" | "user";
  email: string;
};

type AuthContextType = {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      console.log("[AUTH] State changed. User:", authUser?.email || "none");
      try {
        if (authUser) {
          setUser(authUser);
          const userDocRef = doc(db, "users", authUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const profile = userDoc.data() as UserProfile;
            console.log("[AUTH] Profile loaded:", profile.role);
            setUserProfile(profile);
          } else {
            console.warn("[AUTH] No profile document found in Firestore.");
            setUserProfile(null);
          }
          
          if (pathname === "/login" || pathname === "/signup") {
            router.push("/");
          }
        } else {
          setUser(null);
          setUserProfile(null);
          if (pathname !== "/login" && pathname !== "/signup") {
            router.push("/login");
          }
        }
      } catch (error) {
        console.error("[AUTH] Error in auth state transition:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router, pathname]);

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const value = { user, userProfile, loading, signOut };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground animate-pulse">Initializing ShieldAI...</p>
        </div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
