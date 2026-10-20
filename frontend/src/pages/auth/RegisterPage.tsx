import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { register as registerApi } from '../../api/auth';
import type { ErrorResponse } from '../../types';
import axios from 'axios';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';

const registerSchema = z.object({
  username: z
    .string()
    .min(3, 'Username minimal 3 karakter')
    .max(50, 'Username maksimal 50 karakter'),
  email: z.string().min(1, 'Email wajib diisi').email('Format email tidak valid'),
  password: z.string().min(8, 'Password minimal 8 karakter'),
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    setServerError(null);
    setSuccessMessage(null);
    try {
      await registerApi(data);
      setSuccessMessage('Akun berhasil dibuat! Mengarahkan ke halaman login...');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        const body = err.response.data as ErrorResponse;
        const code = body?.error?.code;

        if (err.response.status === 409 && (code === 'CONFLICT' || code === 'DUPLICATE_FIELD')) {
          // Apply field-level errors from server response
          const fields = body.error.fields;
          if (fields) {
            (Object.keys(fields) as (keyof RegisterFormData)[]).forEach((field) => {
              if (field in registerSchema.shape) {
                setError(field, { type: 'server', message: fields[field as string] });
              }
            });
          } else {
            setServerError(body.error.message || 'Data sudah digunakan.');
          }
        } else if (err.response.status === 429) {
          setServerError('Terlalu banyak permintaan. Coba lagi nanti.');
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
      navigate('/');
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
        <h1 className="text-2xl font-bold text-center mb-6">Daftar</h1>

        {serverError && (
          <p role="alert" className="text-destructive text-sm mb-4 text-center">
            {serverError}
          </p>
        )}

        {successMessage && (
          <p role="status" className="text-sm mb-4 text-center text-foreground">
            {successMessage}
          </p>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div>
            <Input
              id="username"
              type="text"
              label="Username"
              autoComplete="username"
              error={errors.username?.message}
              {...register('username')}
            />
          </div>

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
              autoComplete="new-password"
              error={errors.password?.message}
              {...register('password')}
            />
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2"
          >
            {isSubmitting ? 'Memproses...' : 'Daftar'}
          </Button>
        </form>

        <p className="text-center text-sm mt-4">
          Sudah punya akun?{' '}
          <Link to="/login" className="text-primary hover:underline text-sm">
            Masuk
          </Link>
        </p>
      </div>
    </main>
  );
}
