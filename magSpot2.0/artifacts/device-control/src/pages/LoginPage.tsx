import React, { useState } from "react";
import { Loader2, Lock, User, Zap } from "lucide-react";
import { loginToMagSpot } from "@/lib/magspotApi";
import { setSessionToken } from "@/lib/auth";

const ACCENT = "#00d4e8";
const ACCENT_RGB = "0,212,232";

interface LoginPageProps {
  onLogin: () => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    setError(null);
    try {
      const result = await loginToMagSpot(username.trim(), password);
      setSessionToken(result.token);
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, #07090f 0%, #0b0f1a 50%, #0a0e18 100%)" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8 space-y-6"
        style={{
          background: "rgba(10,13,22,0.96)",
          border: "1px solid rgba(255,255,255,0.09)",
          boxShadow: `0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(${ACCENT_RGB},0.06)`,
        }}
      >
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{
              background: `rgba(${ACCENT_RGB},0.14)`,
              border: `1px solid rgba(${ACCENT_RGB},0.32)`,
              boxShadow: `0 0 24px rgba(${ACCENT_RGB},0.15)`,
            }}
          >
            <Zap className="w-6 h-6" style={{ color: ACCENT }} />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-white tracking-tight">MagSpot</h1>
            <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.36)" }}>
              Sign in to continue
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold" style={{ color: "rgba(255,255,255,0.6)" }}>
              Username
            </label>
            <div className="relative">
              <User
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                style={{ color: "rgba(255,255,255,0.3)" }}
              />
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full h-11 rounded-lg pl-9 pr-3 text-sm text-white placeholder-white/20 outline-none"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold" style={{ color: "rgba(255,255,255,0.6)" }}>
              Password
            </label>
            <div className="relative">
              <Lock
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                style={{ color: "rgba(255,255,255,0.3)" }}
              />
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-11 rounded-lg pl-9 pr-3 text-sm text-white placeholder-white/20 outline-none"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
                disabled={loading}
              />
            </div>
          </div>

          {error && (
            <div
              className="rounded-lg px-3 py-2.5 text-xs"
              style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.28)",
                color: "#f87171",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            className="w-full h-11 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-40"
            style={{
              background: `rgba(${ACCENT_RGB},0.16)`,
              border: `1px solid rgba(${ACCENT_RGB},0.35)`,
              color: ACCENT,
              boxShadow: loading ? `0 0 20px rgba(${ACCENT_RGB},0.2)` : "none",
            }}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Signing in…
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <p className="text-center text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>
          Default credentials: admin / admin
        </p>
      </div>
    </div>
  );
}
