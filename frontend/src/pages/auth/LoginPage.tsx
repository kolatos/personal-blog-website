import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { login as loginApi } from '../../api/auth';
import type { ErrorResponse } from '../../types';
import axios from 'axios';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';

const loginSchema = z.object({
  email: z.string().min(1, 'Email wajib diisi').email('Format email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null);
    try {
      const { user, token } = await loginApi(data);
      login(user, token);
      if (user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/blog');
      }
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        const body = err.response.data as ErrorResponse;
        const code = body?.error?.code;
        if (code === 'ACCOUNT_LOCKED') {
          setServerError(
            body.error.message || 'Akun Anda terkunci sementara karena terlalu banyak percobaan login.'
          );
        } else if (err.response.status === 401) {
          setServerError('Email atau password salah.');
        } else if (err.response.status === 429) {
          setServerError('Terlalu banyak percobaan login. Coba lagi nanti.');
        } else {
          setServerError(body?.error?.message || 'Terjadi kesalahan. Coba lagi.');
        }
      } else {
        setServerError('Tidak dapat menghubungi server. Periksa koneksi Anda.');
      }
    }
  };

  function handleBack() {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/blog');
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="bg-card rounded-lg p-8 shadow-md w-full max-w-sm">
        <div className="mb-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            ← Kembali
          </Button>
        </div>
        <h1 className="text-2xl font-bold text-center mb-6">Masuk</h1>

        {serverError && (
          <p role="alert" className="text-destructive text-sm mb-4 text-center">
            {serverError}
          </p>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div>
            <Input
              id="email"
              type="email"
              label="Email"
              autoComplete="email"
              error={errors.email?.message}
              {...register('email')}
            />
          </div>

          <div>
            <Input
              id="password"
              type="password"
              label="Password"
              autoComplete="current-password"
              error={errors.password?.message}
              {...register('password')}
            />
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2"
          >
            {isSubmitting ? 'Memproses...' : 'Masuk'}
          </Button>
        </form>

        <p className="text-center text-sm mt-4">
          Belum punya akun?{' '}
          <Link to="/register" className="text-primary hover:underline text-sm">
            Daftar
          </Link>
        </p>
      </div>
    </main>
  );
}
