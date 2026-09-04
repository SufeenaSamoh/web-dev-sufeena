import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { settings } = useStore();
  const { user, loading: authLoading, signIn } = useAuth();
  const companyName = settings.companyName || "SUSHI HANA";
  const initial = companyName.charAt(0).toUpperCase();

  // Already-authenticated users shouldn't see the login form — send them to the dashboard.
  useEffect(() => {
    if (!authLoading && user) {
      navigate({ to: "/" });
    }
  }, [authLoading, user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !pw) {
      toast.error("Enter email and password");
      return;
    }
    setLoading(true);
    const { error } = await signIn(email, pw);
    setLoading(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Welcome back to Sushi Hana");
    navigate({ to: "/" });
  };

  return (
    <div className="grid min-h-screen bg-[#FBF9F5] text-[#2C221E] lg:grid-cols-12 font-sans">
      {/* Left Panel - Japanese Minimalist Light Warm Cream (7 cols) */}
      <div className="relative hidden lg:col-span-7 lg:flex flex-col justify-between p-12 lg:p-16 bg-[#FAF7F2] border-r border-[#EFECE6]">
        {/* Subtle Decorative Background Geometry */}
        <div className="absolute top-0 right-0 h-80 w-80 bg-[#3D2B1F]/[0.02] rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 h-96 w-96 bg-[#3D2B1F]/[0.03] rounded-full blur-3xl pointer-events-none" />

        {/* Top Header Logo */}
        <div className="relative z-10 flex items-center gap-3.5">
          {settings.logoUrl ? (
            <img
              src={settings.logoUrl}
              alt={companyName}
              className="h-11 w-11 rounded-xl bg-white object-cover border border-[#EFECE6] shadow-xs"
            />
          ) : (
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#3D2B1F] font-bold text-white text-lg shadow-xs">
              {initial}
            </div>
          )}
          <div className="flex flex-col">
            <span className="text-base font-bold uppercase tracking-wider text-[#2C221E]">
              {companyName}
            </span>
            <span className="text-[10px] font-semibold tracking-widest uppercase text-[#7A6B60]">
              INVENTORY CONTROL
            </span>
          </div>
        </div>

        {/* Center Content / System Context */}
        <div className="relative z-10 my-auto max-w-xl space-y-6">
          <h1 className="text-3xl lg:text-4xl font-extrabold text-[#2C221E] leading-tight tracking-tight">
            ระบบจัดการคลังสินค้า <br />
            <span className="text-[#4A3324]">ควบคุมสต็อกง่ายๆ เป็นระเบียบ</span>
          </h1>

          <p className="text-sm lg:text-base text-[#7A6B60] leading-relaxed">
            เรารังสรรค์อาหารทุกจานด้วยความพิถีพิถัน
            พร้อมระบบบริหารจัดการวัตถุดิบและตรวจนับสต็อกแบบรวดเร็ว
            ช่วยให้การทำงานในร้านเป็นไปอย่างมีประสิทธิภาพ
          </p>

          {/* Feature Highlights */}
          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-[#EFECE6]">
            <div className="rounded-xl bg-white p-3.5 border border-[#EFECE6] shadow-2xs">
              <div className="text-xs font-bold text-[#2C221E]">รับสินค้าสะดวก</div>
              <div className="text-[11px] text-[#7A6B60] mt-0.5">บันทึกบิลรวดเร็ว</div>
            </div>
            <div className="rounded-xl bg-white p-3.5 border border-[#EFECE6] shadow-2xs">
              <div className="text-xs font-bold text-[#2C221E]">นับสต๊อกแม่นยำ</div>
              <div className="text-[11px] text-[#7A6B60] mt-0.5">ตัดยอดอัตโนมัติ</div>
            </div>
            <div className="rounded-xl bg-white p-3.5 border border-[#EFECE6] shadow-2xs">
              <div className="text-xs font-bold text-[#2C221E]">รายงาน Real-time</div>
              <div className="text-[11px] text-[#7A6B60] mt-0.5">สรุปผลได้ทันที</div>
            </div>
          </div>
        </div>

        {/* Bottom Footer */}
        <div className="relative z-10 text-xs text-[#7A6B60] flex items-center justify-between pt-4">
          <span>© SUSHI HANA · Inventory Management System</span>
          <span className="text-[11px]">v2.5 Japanese Dining Suite</span>
        </div>
      </div>

      {/* Right Panel - Floating Sign In Form (5 cols) */}
      <div className="lg:col-span-5 flex items-center justify-center p-6 sm:p-12 bg-[#FBF9F5]">
        <Card className="w-full max-w-md rounded-2xl border border-[#EFECE6] bg-white p-8 shadow-xl shadow-[#3D2B1F]/5 text-[#2C221E]">
          {/* Mobile Header Logo */}
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            {settings.logoUrl ? (
              <img
                src={settings.logoUrl}
                alt={companyName}
                className="h-10 w-10 rounded-xl object-cover border border-[#EFECE6]"
              />
            ) : (
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#3D2B1F] font-bold text-white">
                {initial}
              </div>
            )}
            <div className="flex flex-col">
              <span className="font-bold text-base text-[#2C221E]">{companyName}</span>
              <span className="text-[10px] text-[#7A6B60] uppercase tracking-wider font-semibold">
                INVENTORY CONTROL
              </span>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-bold text-[#2C221E]">Sign In</h2>
            <p className="mt-1 text-xs text-[#7A6B60]">
              เข้าสู่ระบบเพื่อจัดการสต็อกและคลังสินค้า SUSHI HANA
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label className="text-xs font-semibold text-[#2C221E]">Email Address</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 rounded-xl bg-[#F7F4EE] border-[#EFECE6] text-[#2C221E] placeholder-[#A09388] focus:border-[#3D2B1F] focus:ring-[#3D2B1F]/15 mt-1 text-sm"
                placeholder="staff@sushihana.com"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-[#2C221E]">Password</Label>
              <Input
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                className="h-11 rounded-xl bg-[#F7F4EE] border-[#EFECE6] text-[#2C221E] placeholder-[#A09388] focus:border-[#3D2B1F] focus:ring-[#3D2B1F]/15 mt-1 text-sm"
                placeholder="••••••••"
              />
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 text-[#7A6B60] cursor-pointer">
                <Checkbox
                  checked={remember}
                  onCheckedChange={(v) => setRemember(!!v)}
                  className="border-[#C8BDBC] data-[state=checked]:bg-[#4A4A4A] data-[state=checked]:border-[#4A4A4A] data-[state=checked]:text-white"
                />
                Remember me
              </label>
              <button
                type="button"
                className="text-[#4A4A4A] font-semibold hover:underline"
                onClick={() => toast.info("Please contact your branch manager to reset password")}
              >
                Forgot password?
              </button>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="h-11 w-full rounded-xl text-sm font-bold bg-[#4A4A4A] text-white hover:bg-[#2F2F2F] active:bg-[#222222] transition-all shadow-2xs mt-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-white" />
              ) : (
                "Sign In to System"
              )}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
