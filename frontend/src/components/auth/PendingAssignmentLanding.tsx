/**
 * Pending Assignment Landing Component
 * 
 * Displays a landing screen for new users who have not yet been assigned to a project.
 * This prevents user bounce before admin assignment and provides clear expectations.
 */

import React from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  Divider,
  Alert,
  Stack,
  Link,
} from '@mui/material';
import {
  Person as PersonIcon,
  Email as EmailIcon,
  Assignment as AssignmentIcon,
  ContactSupport as ContactIcon,
} from '@mui/icons-material';
import { useAppSelector } from '@store/index';

interface PendingAssignmentLandingProps {
  userName?: string;
  userEmail?: string;
  adminEmail?: string;
  onRequestAccess?: () => void;
}

const PendingAssignmentLanding: React.FC<PendingAssignmentLandingProps> = ({
  userName,
  userEmail,
  adminEmail = 'admin@company.com',
  onRequestAccess,
}) => {
  const user = useAppSelector((state) => state.auth.user);
  const displayName = userName || user?.name || 'User';
  const displayEmail = userEmail || user?.email || '';

  const handleRequestAccess = () => {
    if (onRequestAccess) {
      onRequestAccess();
    } else {
      // Default behavior: send notification to admin
      // This would typically call an API endpoint
      // TODO: Implement API call to notify admin
      // eslint-disable-next-line no-console
      console.log('Request access clicked');
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Card
        elevation={3}
        sx={{
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            p: 3,
            textAlign: 'center',
          }}
        >
          <PersonIcon sx={{ fontSize: 64, mb: 2, opacity: 0.9 }} />
          <Typography variant="h4" component="h1" fontWeight={600}>
            Welcome, {displayName}!
          </Typography>
          <Typography variant="body1" sx={{ mt: 1, opacity: 0.9 }}>
            Your account has been created successfully
          </Typography>
        </Box>

        <CardContent sx={{ p: 4 }}>
          <Stack spacing={3}>
            {/* Status Alert */}
            <Alert severity="info" icon={<AssignmentIcon />}>
              <Typography variant="body1" fontWeight={600} gutterBottom>
                Pending Project Assignment
              </Typography>
              <Typography variant="body2">
                An administrator will assign you to a project shortly. Once assigned,
                you'll receive an email notification and can begin using the application.
              </Typography>
            </Alert>

            {/* What to Expect */}
            <Box>
              <Typography variant="h6" gutterBottom fontWeight={600}>
                What happens next?
              </Typography>
              <Stack spacing={1.5} sx={{ mt: 2 }}>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      bgcolor: 'primary.main',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      fontWeight: 600,
                    }}
                  >
                    1
                  </Box>
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
                      Administrator Review
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      An admin will review your account and assign you to the appropriate project(s)
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      bgcolor: 'primary.main',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      fontWeight: 600,
                    }}
                  >
                    2
                  </Box>
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
                      Email Notification
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      You'll receive an email at {displayEmail} when your assignment is complete
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      bgcolor: 'primary.main',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      fontWeight: 600,
                    }}
                  >
                    3
                  </Box>
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
                      Start Using the Application
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Once assigned, you can access your projects and begin scheduling work
                    </Typography>
                  </Box>
                </Box>
              </Stack>
            </Box>

            <Divider />

            {/* Request Access Button */}
            {onRequestAccess && (
              <Box>
                <Button
                  variant="contained"
                  fullWidth
                  size="large"
                  onClick={handleRequestAccess}
                  startIcon={<ContactIcon />}
                  sx={{
                    py: 1.5,
                    fontWeight: 600,
                    fontSize: '1rem',
                  }}
                >
                  Request Project Access
                </Button>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mt: 1, textAlign: 'center' }}
                >
                  Send a notification to your administrator
                </Typography>
              </Box>
            )}

            {/* Contact Information */}
            <Box
              sx={{
                p: 2,
                bgcolor: 'grey.50',
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <EmailIcon fontSize="small" color="action" />
                <Typography variant="subtitle2" fontWeight={600}>
                  Need Help?
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Questions about your account or assignment? Contact your administrator at{' '}
                <Link
                  href={`mailto:${adminEmail}`}
                  sx={{
                    color: 'primary.main',
                    fontWeight: 500,
                    textDecoration: 'none',
                    '&:hover': {
                      textDecoration: 'underline',
                    },
                  }}
                >
                  {adminEmail}
                </Link>
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Container>
  );
};

export default PendingAssignmentLanding;
