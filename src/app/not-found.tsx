import Link from "next/link";
import { Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-24 flex flex-col items-center text-center">
      <div className="text-8xl font-bold text-accent/20 mb-4">404</div>
      <h2 className="text-2xl font-bold mb-2">页面未找到</h2>
      <p className="text-text-secondary mb-8 max-w-md">
        您访问的页面不存在，可能已被移除或链接有误。
      </p>
      <Link
        href="/"
        className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition-colors"
      >
        <Home size={16} />
        返回首页
      </Link>
    </div>
  );
}
