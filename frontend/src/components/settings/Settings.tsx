import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Divider,
  Switch,
  FormControlLabel,
  FormGroup,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  Grid,
} from '@mui/material';
import {
  Person as PersonIcon,
  Notifications as NotificationsIcon,
  Palette as PaletteIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { useAppSelector } from '@store/index';
import { ThemeToggleMenu } from '@components/common/ThemeToggle';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from '@services/api/notificationApi';
import { useRoleBasedLanding } from '@hooks';

const Settings: React.FC = () => {
  const user = useAppSelector((state) => state.auth.user);
  const { defaultRoute, setLandingPreference, getEffectiveLandingRoute } = useRoleBasedLanding();

  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [landingRoute, setLandingRoute] = useState<string>('');

  // Load notification preferences
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        setLoading(true);
        const prefs = await getNotificationPreferences();
        setNotificationPrefs(prefs);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load preferences');
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
    setLandingRoute(getEffectiveLandingRoute());
  }, [getEffectiveLandingRoute]);

  const handleNotificationPrefChange = async (
    key: keyof NotificationPreferences,
    value: boolean | string | string[]
  ) => {
    if (!notificationPrefs) return;

    const updated = { ...notificationPrefs, [key]: value };
    setNotificationPrefs(updated);

    try {
      setSaving(true);
      setError(null);
      const saved = await updateNotificationPreferences({ [key]: value });
      setNotificationPrefs(saved);
      setSuccess('Notification preferences updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update preferences');
      // Revert on error
      setNotificationPrefs(notificationPrefs);
    } finally {
      setSaving(false);
    }
  };

  const handleLandingRouteChange = (route: string) => {
    setLandingRoute(route);
    setLandingPreference(route === defaultRoute ? null : route);
    setSuccess('Landing page preference updated');
    setTimeout(() => setSuccess(null), 3000);
  };

  const landingRouteOptions = [
    { value: defaultRoute, label: 'Default (Role-based)' },
    { value: '/', label: 'Dashboard' },
    { value: '/schedules', label: 'Schedules' },
    { value: '/lookahead', label: 'Lookahead' },
  ];

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Manage your account preferences and application settings
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* User Profile Section */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <PersonIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Profile</Typography>
              </Box>
              <Divider sx={{ mb: 2 }} />
              {user && (
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Name
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    {user.firstName} {user.lastName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mt: 2 }}>
                    Email
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    {user.email}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mt: 2 }}>
                    Role
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    {user.role}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Theme Settings */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <PaletteIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6">Theme</Typography>
                </Box>
                <ThemeToggleMenu />
              </Box>
              <Divider />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Choose your preferred theme mode. System will match your device settings.
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Notification Preferences */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <NotificationsIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Notifications</Typography>
              </Box>
              <Divider sx={{ mb: 2 }} />
              {notificationPrefs && (
                <FormGroup>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={notificationPrefs.inApp}
                        onChange={(e) => handleNotificationPrefChange('inApp', e.target.checked)}
                        disabled={saving}
                      />
                    }
                    label="In-app notifications"
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 4, mb: 2 }}>
                    Receive notifications within the application
                  </Typography>

                  <FormControlLabel
                    control={
                      <Switch
                        checked={notificationPrefs.email}
                        onChange={(e) => handleNotificationPrefChange('email', e.target.checked)}
                        disabled={saving}
                      />
                    }
                    label="Email notifications"
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 4, mb: 2 }}>
                    Receive notifications via email
                  </Typography>

                  <FormControlLabel
                    control={
                      <Switch
                        checked={notificationPrefs.emailDigest}
                        onChange={(e) => handleNotificationPrefChange('emailDigest', e.target.checked)}
                        disabled={saving || !notificationPrefs.email}
                      />
                    }
                    label="Email digest"
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 4, mb: 2 }}>
                    Receive a daily or weekly summary of notifications
                  </Typography>

                  {notificationPrefs.emailDigest && (
                    <FormControl fullWidth sx={{ mt: 2, mb: 2, maxWidth: 300 }}>
                      <InputLabel>Digest Frequency</InputLabel>
                      <Select
                        value={notificationPrefs.digestFrequency}
                        label="Digest Frequency"
                        onChange={(e) =>
                          handleNotificationPrefChange('digestFrequency', e.target.value as 'daily' | 'weekly' | 'never')
                        }
                        disabled={saving || !notificationPrefs.emailDigest}
                      >
                        <MenuItem value="daily">Daily</MenuItem>
                        <MenuItem value="weekly">Weekly</MenuItem>
                        <MenuItem value="never">Never</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                </FormGroup>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Landing Page Preference */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <HomeIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Landing Page</Typography>
              </Box>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Choose which page to open when you log in. Default uses your role-based landing page.
              </Typography>
              <FormControl fullWidth sx={{ maxWidth: 300 }}>
                <InputLabel>Landing Page</InputLabel>
                <Select
                  value={landingRoute}
                  label="Landing Page"
                  onChange={(e) => handleLandingRouteChange(e.target.value)}
                >
                  {landingRouteOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Settings;
