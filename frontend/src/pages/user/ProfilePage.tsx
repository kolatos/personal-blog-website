import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';
import { useAuth } from '../../hooks/useAuth';
import { updateUsername, updatePassword } from '../../api/users';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import type { ErrorResponse } from '../../types';

// ─── Schemas ────────────────────────────────────────────────────────────────

const usernameSchema = z.object({
  username: z
    .string()
    .min(1, 'Username wajib diisi')
    .max(50, 'Username maksimal 50 karakter'),
});

const passwordSchema = z
  .object({
    oldPassword: z.string().min(1, 'Password lama wajib diisi'),
    newPassword: z
      .string()
      .min(8, 'Password baru minimal 8 karakter')
      .max(72, 'Password baru maksimal 72 karakter'),
  })
  .refine((data) => data.newPassword !== data.oldPassword, {
    message: 'Password baru tidak boleh sama dengan password lama',
    path: ['newPassword'],
  });

type UsernameFormData = z.infer<typeof usernameSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

// ─── Component ───────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user, token, login } = useAuth();

  // Username form state
  const [usernameServerError, setUsernameServerError] = useState<string | null>(null);
  const [usernameSuccess, setUsernameSuccess] = useState(false);

  // Password form state
  const [passwordServerError, setPasswordServerError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // ── Username form ──────────────────────────────────────────────────────────

  const {
    register: registerUsername,
    handleSubmit: handleUsernameSubmit,
    formState: { errors: usernameErrors, isSubmitting: isUsernameSubmitting },
  } = useForm<UsernameFormData>({
    resolver: zodResolver(usernameSchema),
    defaultValues: { username: user?.username ?? '' },
  });

  const onUsernameSubmit = async (data: UsernameFormData) => {
    setUsernameServerError(null);
    setUsernameSuccess(false);
    try {
      const updatedUser = await updateUsername({ username: data.username });
      login(updatedUser, token!);
      setUsernameSuccess(true);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        const body = err.response.data as ErrorResponse;
        if (err.response.status === 409) {
          setUsernameServerError('Username sudah digunakan oleh akun lain.');
        } else {
          setUsernameServerError(body?.error?.message || 'Terjadi kesalahan. Coba lagi.');
        }
      } else {
        setUsernameServerError('Tidak dapat menghubungi server. Periksa koneksi Anda.');
      }
    }
  };

  // ── Password form ──────────────────────────────────────────────────────────

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    reset: resetPassword,
    formState: { errors: passwordErrors, isSubmitting: isPasswordSubmitting },
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  const onPasswordSubmit = async (data: PasswordFormData) => {
    setPasswordServerError(null);
    setPasswordSuccess(false);
    try {
      await updatePassword({ oldPassword: data.oldPassword, newPassword: data.newPassword });
      setPasswordSuccess(true);
      resetPassword();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        const body = err.response.data as ErrorResponse;
        const status = err.response.status;
        if (status === 401 || status === 400) {
          const code = body?.error?.code;
          if (code === 'INVALID_OLD_PASSWORD' || status === 401) {
            setPasswordServerError('Password lama tidak benar.');
          } else {
            setPasswordServerError(body?.error?.message || 'Terjadi kesalahan. Coba lagi.');
          }
        } else {
          setPasswordServerError(body?.error?.message || 'Terjadi kesalahan. Coba lagi.');
        }
      } else {
        setPasswordServerError('Tidak dapat menghubungi server. Periksa koneksi Anda.');
      }
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────

  const formattedJoinedAt = user?.joinedAt
    ? new Date(user.joinedAt).toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '—';

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-8">Profil</h1>

      {/* ── Account info card ── */}
      <section aria-labelledby="account-info-heading" className="bg-card rounded-lg p-6 shadow-sm border border-border mb-6">
        <h2 id="account-info-heading" className="text-xl font-semibold mb-4">
          Informasi Akun
        </h2>
        <dl className="space-y-3 text-sm">
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground font-medium">Username</dt>
            <dd className="text-foreground" data-testid="profile-username">{user?.username ?? '—'}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground font-medium">Email</dt>
            <dd className="text-foreground" data-testid="profile-email">{user?.email ?? '—'}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground font-medium">Bergabung sejak</dt>
            <dd className="text-foreground">{formattedJoinedAt}</dd>
          </div>
        </dl>
      </section>

      {/* ── Update username card ── */}
      <section aria-labelledby="update-username-heading" className="bg-card rounded-lg p-6 shadow-sm border border-border mb-6">
        <h2 id="update-username-heading" className="text-xl font-semibold mb-4">
          Ubah Username
        </h2>

        {usernameServerError && (
          <p role="alert" className="text-destructive text-sm mb-4">
            {usernameServerError}
          </p>
        )}
        {usernameSuccess && (
          <p role="status" className="text-sm mb-4 text-green-600 dark:text-green-400">
            Username berhasil diperbarui.
          </p>
        )}

        <form onSubmit={handleUsernameSubmit(onUsernameSubmit)} noValidate className="space-y-4">
          <Input
            id="username"
            label="Username baru"
            autoComplete="username"
            error={usernameErrors.username?.message}
            {...registerUsername('username')}
          />
          <Button
            type="submit"
            variant="default"
            disabled={isUsernameSubmitting}
          >
            {isUsernameSubmitting ? 'Menyimpan...' : 'Simpan Username'}
          </Button>
        </form>
      </section>

      {/* ── Update password card ── */}
      <section aria-labelledby="update-password-heading" className="bg-card rounded-lg p-6 shadow-sm border border-border">
        <h2 id="update-password-heading" className="text-xl font-semibold mb-4">
          Ubah Password
        </h2>

        {passwordServerError && (
          <p role="alert" className="text-destructive text-sm mb-4">
            {passwordServerError}
          </p>
        )}
        {passwordSuccess && (
          <p role="status" className="text-sm mb-4 text-green-600 dark:text-green-400">
            Password berhasil diperbarui.
          </p>
        )}

        <form onSubmit={handlePasswordSubmit(onPasswordSubmit)} noValidate className="space-y-4">
          <Input
            id="oldPassword"
            label="Password lama"
            type="password"
            autoComplete="current-password"
            error={passwordErrors.oldPassword?.message}
            {...registerPassword('oldPassword')}
          />
          <Input
            id="newPassword"
            label="Password baru"
            type="password"
            autoComplete="new-password"
            error={passwordErrors.newPassword?.message}
            {...registerPassword('newPassword')}
          />
          <Button
            type="submit"
            variant="default"
            disabled={isPasswordSubmitting}
          >
            {isPasswordSubmitting ? 'Menyimpan...' : 'Simpan Password'}
          </Button>
        </form>
      </section>
    </main>
  );
}
