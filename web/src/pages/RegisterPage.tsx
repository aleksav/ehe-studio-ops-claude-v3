import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, Link, TextField, Typography } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { ApiError } from '../lib/api';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await register({ email, password, full_name: fullName });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        px: 2,
        bgcolor: 'background.default',
      }}
    >
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography
          variant="h2"
          sx={{
            fontFamily: '"DM Sans", sans-serif',
            fontWeight: 700,
            color: 'primary.main',
            mb: 0.5,
          }}
        >
          EHEStudio Ops
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Studio operations, simplified.
        </Typography>
      </Box>

      <Card
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 420,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 3,
        }}
      >
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h4" sx={{ mb: 3, fontWeight: 600 }}>
            Create account
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TextField
              label="Full name"
              fullWidth
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              sx={{ mb: 2 }}
              autoComplete="name"
              autoFocus
            />
            <TextField
              label="Email address"
              type="email"
              fullWidth
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              sx={{ mb: 2 }}
              autoComplete="email"
            />
            <TextField
              label="Password"
              type="password"
              fullWidth
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              helperText="Must be at least 8 characters"
              sx={{ mb: 3 }}
              autoComplete="new-password"
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={isSubmitting || !fullName || !email || !password}
              sx={{ py: 1.5, fontWeight: 600 }}
            >
              {isSubmitting ? 'Creating account...' : 'Create account'}
            </Button>
          </Box>

          <Typography variant="body2" sx={{ mt: 3, textAlign: 'center' }}>
            Already have an account?{' '}
            <Link component={RouterLink} to="/login" underline="hover" fontWeight={600}>
              Sign in
            </Link>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
