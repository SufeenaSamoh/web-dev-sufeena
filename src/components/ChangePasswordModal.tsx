import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useStore } from "@/lib/store";

interface ChangePasswordModalProps {
  isOpen: boolean;
  onSuccess: () => void;
}

export function ChangePasswordModal({ isOpen, onSuccess }: ChangePasswordModalProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const { currentUser, loadAll } = useStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
        data: { must_change_password: false },
      });

      if (error) {
        toast.error(error.message || "Failed to update password.");
        return;
      }

      // Record audit log
      if (currentUser?.id) {
        await supabase.from("permission_audit_logs").insert({
          target_user_id: currentUser.id,
          actor_id: currentUser.id,
          action: "PASSWORD_CHANGED",
          details: { method: "forced_first_login" },
        });
      }

      toast.success("Password changed successfully! Welcome to the system.");
      await loadAll();
      onSuccess();
    } catch (err) {
      console.error(err);
      toast.error("An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md rounded-2xl p-6 [&>button]:hidden">
        <DialogHeader className="space-y-2 text-left">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 mb-1">
            <KeyRound className="h-6 w-6" />
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
            Change Temporary Password
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            You are currently using a temporary password or your account requires a password change.
            Please set a new secure password before proceeding into the system.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">New Password</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="h-10 rounded-xl text-xs bg-muted/40"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">Confirm New Password</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              className="h-10 rounded-xl text-xs bg-muted/40"
              required
            />
          </div>

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] text-amber-700 dark:text-amber-300 flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
            <span>
              Once updated, you will use this new password for all future logins to SUSHI HANA.
            </span>
          </div>

          <Button
            type="submit"
            disabled={saving}
            className="w-full h-10 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 mt-2"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Update Password & Enter System"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
