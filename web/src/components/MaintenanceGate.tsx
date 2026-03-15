import { useState, useEffect, useCallback } from 'react';
import { Box, Typography, keyframes } from '@mui/material';

const POLL_INTERVAL = 10_000;
const FRONTEND_VERSION = __PACKAGE_VERSION__;

/**
 * Wraps the entire app. If the backend is unreachable or its version SHA
 * doesn't match the frontend SHA, a friendly maintenance page is shown
 * with a hamster-wheel animation. Once versions match the app is revealed.
 */
export default function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'ok' | 'maintenance'>('loading');

  const checkVersion = useCallback(async () => {
    try {
      const apiBase = import.meta.env.VITE_API_URL ?? '';
      const res = await fetch(`${apiBase}/api/version`, { cache: 'no-store' });
      if (!res.ok) {
        setStatus('maintenance');
        return;
      }
      const data: { version: string } = await res.json();
      setStatus(data.version === FRONTEND_VERSION ? 'ok' : 'maintenance');
    } catch {
      setStatus('maintenance');
    }
  }, []);

  useEffect(() => {
    checkVersion();
    const id = setInterval(checkVersion, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [checkVersion]);

  if (status === 'loading') {
    return null;
  }

  if (status === 'ok') {
    return <>{children}</>;
  }

  return <MaintenancePage />;
}

/* ------------------------------------------------------------------ */
/*  Animations                                                        */
/* ------------------------------------------------------------------ */

const spin = keyframes`
  0%   { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

const hamsterRun = keyframes`
  0%   { transform: rotate(0deg)   scaleX(1); }
  25%  { transform: rotate(-12deg) scaleX(0.95); }
  50%  { transform: rotate(0deg)   scaleX(1); }
  75%  { transform: rotate(12deg)  scaleX(0.95); }
  100% { transform: rotate(0deg)   scaleX(1); }
`;

const legRun = keyframes`
  0%   { transform: rotate(0deg); }
  25%  { transform: rotate(30deg); }
  50%  { transform: rotate(0deg); }
  75%  { transform: rotate(-30deg); }
  100% { transform: rotate(0deg); }
`;

const pulse = keyframes`
  0%, 100% { opacity: 0.4; }
  50%      { opacity: 1; }
`;

const bounce = keyframes`
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-6px); }
`;

/* ------------------------------------------------------------------ */
/*  Maintenance page                                                  */
/* ------------------------------------------------------------------ */

function MaintenancePage() {
  return (
    <Box
      component="main"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        bgcolor: '#FAFAFA',
        px: 3,
        textAlign: 'center',
      }}
    >
      {/* Hamster wheel container */}
      <Box sx={{ position: 'relative', width: 200, height: 200, mb: 4 }}>
        {/* Spinning wheel */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: '4px solid',
            borderColor: 'divider',
            animation: `${spin} 3s linear infinite`,
          }}
        >
          {/* Wheel spokes */}
          {[0, 45, 90, 135].map((deg) => (
            <Box
              key={deg}
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: '100%',
                height: 2,
                bgcolor: 'divider',
                transformOrigin: 'center',
                transform: `translate(-50%, -50%) rotate(${deg}deg)`,
              }}
            />
          ))}
        </Box>

        {/* Hamster body — sits still while wheel spins */}
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 2,
          }}
        >
          {/* Body */}
          <Box
            sx={{
              width: 48,
              height: 36,
              bgcolor: 'primary.main',
              borderRadius: '50%',
              position: 'relative',
              animation: `${hamsterRun} 0.4s ease-in-out infinite`,
            }}
          >
            {/* Head */}
            <Box
              sx={{
                position: 'absolute',
                top: -8,
                right: -10,
                width: 24,
                height: 22,
                bgcolor: 'primary.main',
                borderRadius: '50%',
              }}
            >
              {/* Eye */}
              <Box
                sx={{
                  position: 'absolute',
                  top: 7,
                  right: 5,
                  width: 5,
                  height: 5,
                  bgcolor: '#fff',
                  borderRadius: '50%',
                }}
              />
              {/* Ear */}
              <Box
                sx={{
                  position: 'absolute',
                  top: -4,
                  right: 4,
                  width: 10,
                  height: 10,
                  bgcolor: '#C4177A',
                  borderRadius: '50%',
                }}
              />
            </Box>

            {/* Front leg */}
            <Box
              sx={{
                position: 'absolute',
                bottom: -8,
                right: 4,
                width: 6,
                height: 14,
                bgcolor: 'primary.main',
                borderRadius: 3,
                transformOrigin: 'top center',
                animation: `${legRun} 0.3s ease-in-out infinite`,
              }}
            />
            {/* Back leg */}
            <Box
              sx={{
                position: 'absolute',
                bottom: -8,
                left: 6,
                width: 6,
                height: 14,
                bgcolor: 'primary.main',
                borderRadius: 3,
                transformOrigin: 'top center',
                animation: `${legRun} 0.3s ease-in-out infinite 0.15s`,
              }}
            />

            {/* Tail */}
            <Box
              sx={{
                position: 'absolute',
                top: 2,
                left: -8,
                width: 12,
                height: 8,
                bgcolor: '#C4177A',
                borderRadius: '50% 0 0 50%',
              }}
            />
          </Box>
        </Box>
      </Box>

      {/* Text */}
      <Typography
        variant="h4"
        sx={{
          fontFamily: '"DM Sans", sans-serif',
          fontWeight: 700,
          color: 'text.primary',
          mb: 1,
        }}
      >
        We&rsquo;re updating, back shortly
      </Typography>

      <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: 400, mb: 4 }}>
        Our hamster is running as fast as it can to deploy the latest changes. Hang tight!
      </Typography>

      {/* Checking indicator */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {[0, 1, 2].map((i) => (
          <Box
            key={i}
            sx={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              bgcolor: 'primary.main',
              animation: `${bounce} 1s ease-in-out infinite`,
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
        <Typography
          variant="caption"
          sx={{
            color: 'text.disabled',
            ml: 1,
            animation: `${pulse} 2s ease-in-out infinite`,
          }}
        >
          Checking for updates...
        </Typography>
      </Box>
    </Box>
  );
}
