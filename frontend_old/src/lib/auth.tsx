import { ReactNode } from 'react';
import {
  ClerkProvider,
  RedirectToSignIn,
  SignIn,
  SignedIn,
  SignedOut,
  UserButton,
  useAuth as useClerkAuth,
  useUser as useClerkUser,
} from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const hasClerk = Boolean(PUBLISHABLE_KEY);

export function AuthProvider({ children }: { children: ReactNode }) {
  if (!hasClerk) {
    return <>{children}</>;
  }

  return <ClerkProvider publishableKey={PUBLISHABLE_KEY}>{children}</ClerkProvider>;
}

export function useOptionalAuth() {
  if (!hasClerk) {
    return { getToken: async () => null };
  }

  return useClerkAuth();
}

export function useOptionalUser() {
  if (!hasClerk) {
    return { user: { firstName: 'Replit', username: 'User' } };
  }

  return useClerkUser();
}

export function AuthenticatedRoute({ children }: { children: ReactNode }) {
  if (!hasClerk) {
    return <>{children}</>;
  }

  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}

export function SignInRoute() {
  if (!hasClerk) {
    return <Navigate to="/" replace />;
  }

  return <SignIn routing="path" path="/sign-in" />;
}

export function UserMenu() {
  if (!hasClerk) {
    return null;
  }

  return <UserButton afterSignOutUrl="/" />;
}