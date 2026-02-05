/**
 * Bulk Import Component
 *
 * Phase 11: CSV bulk import for users.
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { userManagementApi, type ImportResult } from '@services/api/userManagementApi';

interface BulkImportProps {
  open: boolean;
  onClose: () => void;
}

const BulkImport: React.FC<BulkImportProps> = ({ open, onClose }) => {
  const [csvContent, setCsvContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleImport = async () => {
    if (!csvContent.trim()) {
      setError('CSV content is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const importResult = await userManagementApi.importUsers(csvContent);
      setResult(importResult);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to import users');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCsvContent('');
    setResult(null);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Bulk Import Users</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            CSV Format: email,firstName,lastName,password (password is optional)
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Example:
          </Typography>
          <Paper sx={{ p: 1, mt: 1, fontFamily: 'monospace', fontSize: '0.875rem' }}>
            email,firstName,lastName,password<br />
            john.doe@example.com,John,Doe,SecurePass123!<br />
            jane.smith@example.com,Jane,Smith
          </Paper>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {result && (
          <Alert severity={result.errors.length > 0 ? 'warning' : 'success'} sx={{ mb: 2 }}>
            Import complete: {result.imported} imported, {result.updated} updated, {result.errors.length} errors
          </Alert>
        )}

        <TextField
          fullWidth
          multiline
          rows={10}
          label="CSV Content"
          value={csvContent}
          onChange={(e) => setCsvContent(e.target.value)}
          placeholder="email,firstName,lastName,password&#10;john.doe@example.com,John,Doe,SecurePass123!"
          sx={{ mb: 2 }}
        />

        {result && result.errors.length > 0 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Import Errors
            </Typography>
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Row</TableCell>
                    <TableCell>Error</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {result.errors.map((err, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{err.row}</TableCell>
                      <TableCell>{err.error}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Close</Button>
        <Button onClick={handleImport} variant="contained" disabled={!csvContent.trim() || loading}>
          {loading ? <CircularProgress size={20} /> : 'Import'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BulkImport;
