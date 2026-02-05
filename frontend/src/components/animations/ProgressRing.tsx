import React, { useMemo } from 'react';
import { Box, Typography, useTheme } from '@mui/material';

// ============================================
// Types
// ============================================

interface ProgressRingProps {
  /** Progress percentage (0-100) */
  progress: number;
  /** Size of the ring in pixels */
  size?: number;
  /** Stroke width in pixels */
  strokeWidth?: number;
  /** Whether to show the percentage text */
  showText?: boolean;
  /** Custom text to display instead of percentage */
  text?: string;
  /** Text size variant */
  textVariant?: 'caption' | 'body2' | 'body1' | 'h6';
  /** Whether to animate the progress fill */
  animated?: boolean;
  /** Color override (defaults to theme-based colors) */
  color?: string;
  /** Background track color */
  trackColor?: string;
  /** Additional CSS class */
  className?: string;
}

// ============================================
// Progress Ring Component
// ============================================

const ProgressRing: React.FC<ProgressRingProps> = ({
  progress,
  size = 48,
  strokeWidth = 4,
  showText = true,
  text,
  textVariant = 'caption',
  animated = true,
  color,
  trackColor,
  className,
}) => {
  const theme = useTheme();
  
  // Clamp progress between 0 and 100
  const clampedProgress = Math.min(100, Math.max(0, progress));
  
  // Calculate SVG properties
  const center = size / 2;
  const radius = center - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedProgress / 100) * circumference;

  // Determine color based on progress
  const progressColor = useMemo(() => {
    if (color) return color;
    
    if (clampedProgress >= 100) {
      return theme.palette.success.main;
    } else if (clampedProgress >= 75) {
      return theme.palette.info.main;
    } else if (clampedProgress >= 50) {
      return theme.palette.primary.main;
    } else if (clampedProgress >= 25) {
      return theme.palette.warning.main;
    } else {
      return theme.palette.grey[400];
    }
  }, [color, clampedProgress, theme]);

  // Track color
  const track = trackColor || (theme.palette.mode === 'dark' 
    ? 'rgba(255, 255, 255, 0.12)' 
    : 'rgba(0, 0, 0, 0.08)');

  // Display text
  const displayText = text ?? `${Math.round(clampedProgress)}%`;

  return (
    <Box
      className={className}
      sx={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
      }}
    >
      <svg
        width={size}
        height={size}
        style={{ transform: 'rotate(-90deg)' }}
      >
        {/* Background track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={track}
          strokeWidth={strokeWidth}
        />
        
        {/* Progress arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={progressColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{
            transition: animated ? 'stroke-dashoffset 300ms ease-out, stroke 200ms ease-out' : 'none',
          }}
        />
      </svg>
      
      {/* Center text */}
      {showText && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography
            variant={textVariant}
            component="span"
            sx={{
              fontWeight: 600,
              color: progressColor,
              lineHeight: 1,
              transition: animated ? 'color 200ms ease-out' : 'none',
            }}
          >
            {displayText}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

// ============================================
// Mini Progress Ring (for inline use)
// ============================================

interface MiniProgressRingProps {
  progress: number;
  size?: number;
  color?: string;
}

export const MiniProgressRing: React.FC<MiniProgressRingProps> = ({
  progress,
  size = 20,
  color,
}) => {
  return (
    <ProgressRing
      progress={progress}
      size={size}
      strokeWidth={2}
      showText={false}
      color={color}
    />
  );
};

// ============================================
// Progress Ring with Label
// ============================================

interface ProgressRingWithLabelProps extends ProgressRingProps {
  label: string;
  labelPosition?: 'bottom' | 'right';
}

export const ProgressRingWithLabel: React.FC<ProgressRingWithLabelProps> = ({
  label,
  labelPosition = 'bottom',
  ...props
}) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: labelPosition === 'bottom' ? 'column' : 'row',
        alignItems: 'center',
        gap: 1,
      }}
    >
      <ProgressRing {...props} />
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
};

// ============================================
// Default Export
// ============================================

export default ProgressRing;
