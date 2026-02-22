import React, { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

function base64UrlDecode(input: string) {
  // Replace URL-safe characters and add padding
  let base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  try {
    // atob is available in browser runtime
    return decodeURIComponent(
      Array.prototype.map
        .call(atob(base64), (c: string) => {
          return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join("")
    );
  } catch (e) {
    return null;
  }
}

function decodeJwt(token: string): Record<string, any> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid token");
  const payload = base64UrlDecode(parts[1]);
  if (!payload) throw new Error("Unable to decode token payload");
  return JSON.parse(payload);
}

function isTokenValid(token?: string | null) {
  if (!token) return false;
  try {
    const payload = decodeJwt(token);
    const exp = payload?.exp;
    if (!exp) return false;
    const now = Math.floor(Date.now() / 1000);
    return now < Number(exp);
  } catch (e) {
    return false;
  }
}

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const location = useLocation();
  const token = localStorage.getItem("access_token");

  if (!isTokenValid(token)) {
    return <Navigate to="/ngo-login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
