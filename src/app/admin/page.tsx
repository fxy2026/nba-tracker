"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, LockKeyhole, LogOut, RefreshCw } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import AnalyticsOverview from "./_components/AnalyticsOverview";
import OperationsStatus from "./_components/OperationsStatus";
import { readAdminResponse, fetchAdmin, adminErrorText } from "./_components/admin-client";
import styles from "./admin.module.css";

export default function AdminPage() {
  const { locale, t } = useLocale();
  const zh = locale === "zh";
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [authError, setAuthError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const loginRequest = useRef<AbortController | null>(null);

  useEffect(() => () => { loginRequest.current?.abort(); loginRequest.current = null; }, []);

  const logout = useCallback(() => {
    loginRequest.current?.abort(); loginRequest.current = null;
    setPassword(""); setAuthenticated(false); setLoginLoading(false);
    setAuthError("");
  }, []);
  const unauthorized = useCallback(() => {
    logout();
    setAuthError(zh ? "管理权限验证失败，请重新登录。" : "Your admin access could not be verified. Sign in again.");
  }, [logout, zh]);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    if (loginRequest.current) return;
    if (!password.trim()) { setAuthError(t.admin.enterPassword); return; }
    const request = new AbortController();
    loginRequest.current = request; setLoginLoading(true); setAuthError("");
    try {
      const response = await fetchAdmin("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }), signal: request.signal, cache: "no-store" });
      const result = await readAdminResponse<{ success?: boolean }>(response);
      if (result.success !== true) throw new Error(zh ? "登录未成功，请重试。" : "Sign-in wasn't confirmed. Please retry.");
      if (!request.signal.aborted) { setAuthenticated(true); setAuthError(""); }
    } catch (error) {
      if (!request.signal.aborted) setAuthError(adminErrorText(error, zh, zh ? "网络连接失败，请重试。" : "Couldn't connect. Please try again."));
    } finally {
      if (loginRequest.current === request) { loginRequest.current = null; setLoginLoading(false); }
    }
  }

  if (!authenticated) return <div className={styles.login}>
    <div className={styles.loginIntro}><p className={styles.eyebrow}>NBA TRACKER · ADMIN</p><h1 className={styles.loginTitle}>{zh ? <>掌握访问，<br />看清数据。</> : <>Your site.<br />A clearer view.</>}</h1><p className={styles.subtitle}>{zh ? "访问趋势、内容表现与数据状态，一个清晰的管理入口。" : "Traffic trends, content performance, and data coverage in one focused workspace."}</p><Link href="/" prefetch={false} className={`${styles.button} ${styles.loginLink}`}><ArrowLeft size={15} />{zh ? "返回网站" : "Back to site"}</Link></div>
    <form className={styles.loginForm} onSubmit={login}>
      <div className={styles.statusIcon}><LockKeyhole size={20} /></div><div><h2 className={styles.sectionTitle}>{t.admin.login}</h2><p className={styles.caption}>{zh ? "输入管理密码以访问后台。" : "Enter your admin password to continue."}</p></div>
      <label className={styles.label} htmlFor="admin-password">{zh ? "管理密码" : "Admin password"}<input id="admin-password" name="password" className={styles.input} type="password" autoComplete="current-password" value={password} disabled={loginLoading} onChange={event => setPassword(event.target.value)} placeholder={t.admin.passwordPlaceholder} aria-invalid={!!authError} aria-describedby={authError ? "admin-auth-error" : undefined} required /></label>
      {authError && <p id="admin-auth-error" className={styles.error} role="alert">{authError}</p>}
      <button type="submit" className={styles.primaryButton} disabled={loginLoading}>{loginLoading ? <RefreshCw size={16} className={styles.spin} /> : <ArrowUpRight size={16} />}{loginLoading ? t.admin.loggingIn : t.admin.loginBtn}</button>
      <p className={styles.loginFine}>{zh ? "管理密码仅用于当前页面的验证，不写入浏览器存储。刷新或退出登录后需重新验证。" : "Your password stays in this page's memory and isn't written to browser storage. Refreshing or signing out clears this page’s access."}</p>
    </form>
  </div>;

  return <div className={styles.shell}>
    <header className={styles.header}><div><p className={styles.eyebrow}>NBA TRACKER · ADMIN</p><h1 className={styles.title}>{zh ? "运营中心" : "Control room"}</h1><p className={styles.subtitle}>{zh ? "查看访问趋势，掌握数据状态。" : "Understand your traffic. Know where your data stands."}</p></div><div className={styles.headerActions}><Link href="/" prefetch={false} className={styles.button}><ArrowUpRight size={15} />{zh ? "查看网站" : "View site"}</Link><button type="button" className={styles.button} onClick={logout}><LogOut size={15} />{zh ? "退出" : "Sign out"}</button></div></header>
    <div className={styles.stack}><AnalyticsOverview password={password} onUnauthorized={unauthorized} /><OperationsStatus password={password} onUnauthorized={unauthorized} /></div>
  </div>;
}
