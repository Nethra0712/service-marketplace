import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api-client';

const replace = vi.fn();
const login = vi.fn();
let authState: { status: 'loading' | 'authenticated' | 'unauthenticated' } = {
  status: 'unauthenticated',
};

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ state: authState, login, logout: vi.fn() }),
}));

// Imported after the mocks above so the page picks up the mocked modules.
const { default: LoginPage } = await import('@/app/login/page');

describe('LoginPage', () => {
  beforeEach(() => {
    replace.mockClear();
    login.mockClear();
    authState = { status: 'unauthenticated' };
  });

  it('submits the entered credentials and redirects on success', async () => {
    login.mockResolvedValue(undefined);
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'correct-horse-battery' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith('owner@example.com', 'correct-horse-battery');
    });
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/');
    });
  });

  it('shows the backend error message and does not redirect on failed login', async () => {
    login.mockRejectedValue(
      new ApiError(401, 'INVALID_ADMIN_CREDENTIALS', 'Invalid email or password.'),
    );
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong-password' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Invalid email or password.')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalledWith('/');
  });

  it('redirects to / immediately when the session is already authenticated', () => {
    authState = { status: 'authenticated' };
    render(<LoginPage />);

    expect(replace).toHaveBeenCalledWith('/');
  });
});
