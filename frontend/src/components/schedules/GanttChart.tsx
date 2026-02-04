import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import { Box, Paper, IconButton, Tooltip, Typography, Chip, Stack } from '@mui/material';
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  FitScreen as FitScreenIcon,
  Today as TodayIcon,
} from '@mui/icons-material';
import { ganttColors, statusColors } from '../../theme';
import type { Activity } from '@store/slices/activitySlice';

// ============================================================================
// Types
// ============================================================================

interface GanttChartProps {
  activities: Activity[];
  startDate?: Date;
  endDate?: Date;
  onActivityClick?: (activity: Activity) => void;
  onActivityDoubleClick?: (activity: Activity) => void;
  selectedActivityId?: string | null;
  showCriticalPath?: boolean;
  showProgress?: boolean;
  rowHeight?: number;
  minColumnWidth?: number;
}

interface ProcessedActivity extends Activity {
  level: number;
  parsedStartDate: Date;
  parsedFinishDate: Date;
}

// ============================================================================
// Constants
// ============================================================================

const HEADER_HEIGHT = 50;
const ROW_HEIGHT_DEFAULT = 36;
const LABEL_WIDTH = 280;
const MIN_BAR_WIDTH = 4;
const PADDING = { top: 10, right: 20, bottom: 10, left: 10 };

// ============================================================================
// Utility Functions
// ============================================================================

const parseDate = (dateStr: string | Date): Date => {
  if (dateStr instanceof Date) return dateStr;
  return new Date(dateStr);
};

const formatDate = (date: Date): string => {
  return d3.timeFormat('%b %d, %Y')(date);
};

const getActivityColor = (activity: Activity, showCriticalPath: boolean): string => {
  if (showCriticalPath && activity.isCritical) {
    return ganttColors.criticalPath;
  }
  if (activity.isDelayed) {
    return statusColors.delayed;
  }
  if (activity.isAtRisk) {
    return statusColors.atRisk;
  }
  if (activity.percentComplete === 100) {
    return statusColors.completed;
  }
  return ganttColors.normalTask;
};

const getProgressColor = (activity: Activity): string => {
  if (activity.percentComplete === 100) {
    return statusColors.completed;
  }
  if (activity.isDelayed) {
    return d3.color(statusColors.delayed)?.darker(0.5)?.toString() || statusColors.delayed;
  }
  return ganttColors.progress;
};

// ============================================================================
// GanttChart Component
// ============================================================================

export const GanttChart: React.FC<GanttChartProps> = ({
  activities,
  startDate: propStartDate,
  endDate: propEndDate,
  onActivityClick,
  onActivityDoubleClick,
  selectedActivityId,
  showCriticalPath = true,
  showProgress = true,
  rowHeight = ROW_HEIGHT_DEFAULT,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const labelsSvgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });
  const [transform, setTransform] = useState(d3.zoomIdentity);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // Process activities and calculate date range
  const { processedActivities, dateExtent, chartHeight } = useMemo(() => {
    if (!activities || activities.length === 0) {
      return {
        processedActivities: [],
        dateExtent: [new Date(), new Date()] as [Date, Date],
        chartHeight: 200,
      };
    }

    const processed: ProcessedActivity[] = activities.map((activity, index) => ({
      ...activity,
      level: index,
      parsedStartDate: parseDate(activity.startDate),
      parsedFinishDate: parseDate(activity.finishDate),
    }));

    // Sort by start date, then by name
    processed.sort((a, b) => {
      const dateDiff = a.parsedStartDate.getTime() - b.parsedStartDate.getTime();
      if (dateDiff !== 0) return dateDiff;
      return a.name.localeCompare(b.name);
    });

    // Reassign levels after sorting
    processed.forEach((activity, index) => {
      activity.level = index;
    });

    // Calculate date extent
    const dates = processed.flatMap((a) => [a.parsedStartDate, a.parsedFinishDate]);
    const minDate = propStartDate || d3.min(dates) || new Date();
    const maxDate = propEndDate || d3.max(dates) || new Date();

    // Add padding to date range (7 days on each side)
    const paddedMinDate = d3.timeDay.offset(minDate, -7);
    const paddedMaxDate = d3.timeDay.offset(maxDate, 7);

    const height = Math.max(200, processed.length * rowHeight + HEADER_HEIGHT + PADDING.top + PADDING.bottom);

    return {
      processedActivities: processed,
      dateExtent: [paddedMinDate, paddedMaxDate] as [Date, Date],
      chartHeight: height,
    };
  }, [activities, propStartDate, propEndDate, rowHeight]);

  // Create scales
  const xScale = useMemo(() => {
    const chartWidth = dimensions.width - LABEL_WIDTH - PADDING.left - PADDING.right;
    return d3.scaleTime().domain(dateExtent).range([0, chartWidth]);
  }, [dateExtent, dimensions.width]);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        setDimensions({
          width: Math.max(600, width),
          height: chartHeight,
        });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [chartHeight]);

  // Initialize zoom behavior
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const chartWidth = dimensions.width - LABEL_WIDTH - PADDING.left - PADDING.right;

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 10])
      .translateExtent([
        [-100, 0],
        [chartWidth + 100, chartHeight],
      ])
      .on('zoom', (event) => {
        setTransform(event.transform);
      });

    zoomRef.current = zoom;
    svg.call(zoom);

    return () => {
      svg.on('.zoom', null);
    };
  }, [dimensions.width, chartHeight]);

  // Render chart
  useEffect(() => {
    if (!svgRef.current || !labelsSvgRef.current || processedActivities.length === 0) return;

    const svg = d3.select(svgRef.current);
    const labelsSvg = d3.select(labelsSvgRef.current);
    const chartWidth = dimensions.width - LABEL_WIDTH - PADDING.left - PADDING.right;

    // Clear previous content
    svg.selectAll('*').remove();
    labelsSvg.selectAll('*').remove();

    // Create transformed x scale
    const transformedXScale = transform.rescaleX(xScale);

    // ========================================================================
    // Time axis and grid
    // ========================================================================

    const timeAxisGroup = svg.append('g').attr('class', 'time-axis');

    // Background for header
    timeAxisGroup
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', chartWidth)
      .attr('height', HEADER_HEIGHT)
      .attr('fill', '#F8FAFC');

    // Determine tick interval based on zoom level
    const domainWidth = transformedXScale.domain()[1].getTime() - transformedXScale.domain()[0].getTime();
    const daysVisible = domainWidth / (1000 * 60 * 60 * 24);
    
    let tickInterval: d3.TimeInterval;
    let tickFormat: string;
    
    if (daysVisible > 365) {
      tickInterval = d3.timeMonth.every(3) || d3.timeMonth;
      tickFormat = '%b %Y';
    } else if (daysVisible > 90) {
      tickInterval = d3.timeMonth.every(1) || d3.timeMonth;
      tickFormat = '%b %Y';
    } else if (daysVisible > 30) {
      tickInterval = d3.timeWeek.every(1) || d3.timeWeek;
      tickFormat = '%b %d';
    } else {
      tickInterval = d3.timeDay.every(1) || d3.timeDay;
      tickFormat = '%b %d';
    }

    // Time axis
    const timeAxis = d3
      .axisTop(transformedXScale)
      .ticks(tickInterval)
      .tickFormat((d) => d3.timeFormat(tickFormat)(d as Date))
      .tickSize(-chartHeight + HEADER_HEIGHT);

    timeAxisGroup
      .append('g')
      .attr('class', 'axis')
      .attr('transform', `translate(0, ${HEADER_HEIGHT})`)
      .call(timeAxis)
      .call((g) => {
        g.select('.domain').remove();
        g.selectAll('.tick line')
          .attr('stroke', '#E2E8F0')
          .attr('stroke-dasharray', '2,2');
        g.selectAll('.tick text')
          .attr('fill', '#64748B')
          .attr('font-size', '11px')
          .attr('font-weight', 500)
          .attr('dy', '-0.5em');
      });

    // Today line
    const today = new Date();
    if (today >= dateExtent[0] && today <= dateExtent[1]) {
      const todayX = transformedXScale(today);
      if (todayX >= 0 && todayX <= chartWidth) {
        timeAxisGroup
          .append('line')
          .attr('class', 'today-line')
          .attr('x1', todayX)
          .attr('x2', todayX)
          .attr('y1', HEADER_HEIGHT)
          .attr('y2', chartHeight)
          .attr('stroke', ganttColors.today)
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', '4,4');

        timeAxisGroup
          .append('text')
          .attr('x', todayX)
          .attr('y', HEADER_HEIGHT - 5)
          .attr('text-anchor', 'middle')
          .attr('fill', ganttColors.today)
          .attr('font-size', '10px')
          .attr('font-weight', 600)
          .text('TODAY');
      }
    }

    // ========================================================================
    // Activity bars
    // ========================================================================

    const barsGroup = svg.append('g').attr('class', 'bars').attr('transform', `translate(0, ${HEADER_HEIGHT})`);

    // Row backgrounds (alternating)
    processedActivities.forEach((activity, i) => {
      barsGroup
        .append('rect')
        .attr('class', 'row-bg')
        .attr('x', 0)
        .attr('y', i * rowHeight)
        .attr('width', chartWidth)
        .attr('height', rowHeight)
        .attr('fill', i % 2 === 0 ? '#FFFFFF' : '#F8FAFC')
        .attr('opacity', activity.id === selectedActivityId ? 0.5 : 1);

      // Selection highlight
      if (activity.id === selectedActivityId) {
        barsGroup
          .append('rect')
          .attr('class', 'selection-highlight')
          .attr('x', 0)
          .attr('y', i * rowHeight)
          .attr('width', chartWidth)
          .attr('height', rowHeight)
          .attr('fill', '#3B82F6')
          .attr('opacity', 0.1);
      }
    });

    // Activity bars
    processedActivities.forEach((activity) => {
      const x1 = transformedXScale(activity.parsedStartDate);
      const x2 = transformedXScale(activity.parsedFinishDate);
      const barWidth = Math.max(MIN_BAR_WIDTH, x2 - x1);
      const y = activity.level * rowHeight + rowHeight * 0.2;
      const barHeight = rowHeight * 0.6;

      // Skip if bar is completely outside visible area
      if (x2 < 0 || x1 > chartWidth) return;

      const barGroup = barsGroup
        .append('g')
        .attr('class', 'activity-bar')
        .attr('data-activity-id', activity.id)
        .style('cursor', 'pointer');

      // Bar background (full duration)
      barGroup
        .append('rect')
        .attr('class', 'bar-bg')
        .attr('x', Math.max(0, x1))
        .attr('y', y)
        .attr('width', Math.min(barWidth, chartWidth - Math.max(0, x1)))
        .attr('height', barHeight)
        .attr('rx', 4)
        .attr('ry', 4)
        .attr('fill', getActivityColor(activity, showCriticalPath))
        .attr('opacity', 0.9);

      // Progress bar
      if (showProgress && activity.percentComplete > 0) {
        const progressWidth = (barWidth * activity.percentComplete) / 100;
        barGroup
          .append('rect')
          .attr('class', 'bar-progress')
          .attr('x', Math.max(0, x1))
          .attr('y', y)
          .attr('width', Math.min(progressWidth, chartWidth - Math.max(0, x1)))
          .attr('height', barHeight)
          .attr('rx', 4)
          .attr('ry', 4)
          .attr('fill', getProgressColor(activity))
          .attr('opacity', 0.3);
      }

      // Critical path indicator (border)
      if (showCriticalPath && activity.isCritical) {
        barGroup
          .append('rect')
          .attr('class', 'critical-indicator')
          .attr('x', Math.max(0, x1))
          .attr('y', y)
          .attr('width', Math.min(barWidth, chartWidth - Math.max(0, x1)))
          .attr('height', barHeight)
          .attr('rx', 4)
          .attr('ry', 4)
          .attr('fill', 'none')
          .attr('stroke', ganttColors.criticalPath)
          .attr('stroke-width', 2);
      }

      // Selection border
      if (activity.id === selectedActivityId) {
        barGroup
          .append('rect')
          .attr('class', 'selection-border')
          .attr('x', Math.max(0, x1) - 2)
          .attr('y', y - 2)
          .attr('width', Math.min(barWidth + 4, chartWidth - Math.max(0, x1) + 4))
          .attr('height', barHeight + 4)
          .attr('rx', 6)
          .attr('ry', 6)
          .attr('fill', 'none')
          .attr('stroke', '#3B82F6')
          .attr('stroke-width', 2);
      }

      // Percent complete text (inside bar if wide enough)
      if (barWidth > 40) {
        barGroup
          .append('text')
          .attr('x', Math.max(0, x1) + barWidth / 2)
          .attr('y', y + barHeight / 2)
          .attr('dy', '0.35em')
          .attr('text-anchor', 'middle')
          .attr('fill', '#FFFFFF')
          .attr('font-size', '10px')
          .attr('font-weight', 600)
          .text(`${activity.percentComplete}%`);
      }

      // Click handlers
      barGroup.on('click', (event) => {
        event.stopPropagation();
        onActivityClick?.(activity);
      });

      barGroup.on('dblclick', (event) => {
        event.stopPropagation();
        onActivityDoubleClick?.(activity);
      });

      // Tooltip
      barGroup
        .append('title')
        .text(
          `${activity.name}\n` +
            `Start: ${formatDate(activity.parsedStartDate)}\n` +
            `Finish: ${formatDate(activity.parsedFinishDate)}\n` +
            `Duration: ${activity.duration} days\n` +
            `Progress: ${activity.percentComplete}%` +
            (activity.isCritical ? '\n⚠️ Critical Path' : '')
        );
    });

    // ========================================================================
    // Labels (fixed position)
    // ========================================================================

    // Background
    labelsSvg
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', LABEL_WIDTH)
      .attr('height', chartHeight)
      .attr('fill', '#FFFFFF');

    // Header
    labelsSvg
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', LABEL_WIDTH)
      .attr('height', HEADER_HEIGHT)
      .attr('fill', '#F1F5F9');

    labelsSvg
      .append('text')
      .attr('x', PADDING.left + 10)
      .attr('y', HEADER_HEIGHT / 2)
      .attr('dy', '0.35em')
      .attr('fill', '#1E293B')
      .attr('font-size', '12px')
      .attr('font-weight', 600)
      .text('Activity Name');

    // Activity labels
    const labelsGroup = labelsSvg.append('g').attr('transform', `translate(0, ${HEADER_HEIGHT})`);

    processedActivities.forEach((activity, i) => {
      const labelGroup = labelsGroup.append('g').attr('class', 'label-row');

      // Row background
      labelGroup
        .append('rect')
        .attr('x', 0)
        .attr('y', i * rowHeight)
        .attr('width', LABEL_WIDTH)
        .attr('height', rowHeight)
        .attr('fill', activity.id === selectedActivityId ? '#EFF6FF' : i % 2 === 0 ? '#FFFFFF' : '#F8FAFC');

      // Critical path indicator dot
      if (activity.isCritical) {
        labelGroup
          .append('circle')
          .attr('cx', PADDING.left + 8)
          .attr('cy', i * rowHeight + rowHeight / 2)
          .attr('r', 4)
          .attr('fill', ganttColors.criticalPath);
      }

      // Activity name
      labelGroup
        .append('text')
        .attr('x', PADDING.left + (activity.isCritical ? 20 : 10))
        .attr('y', i * rowHeight + rowHeight / 2)
        .attr('dy', '0.35em')
        .attr('fill', '#1E293B')
        .attr('font-size', '12px')
        .attr('font-weight', activity.isCritical ? 600 : 400)
        .text(activity.name.length > 30 ? activity.name.substring(0, 30) + '...' : activity.name)
        .append('title')
        .text(activity.name);

      // Click handler for labels
      labelGroup.style('cursor', 'pointer').on('click', () => {
        onActivityClick?.(activity);
      });
    });

    // Border between labels and chart
    labelsSvg
      .append('line')
      .attr('x1', LABEL_WIDTH - 1)
      .attr('x2', LABEL_WIDTH - 1)
      .attr('y1', 0)
      .attr('y2', chartHeight)
      .attr('stroke', '#E2E8F0')
      .attr('stroke-width', 1);
  }, [
    processedActivities,
    dimensions,
    transform,
    xScale,
    dateExtent,
    chartHeight,
    rowHeight,
    selectedActivityId,
    showCriticalPath,
    showProgress,
    onActivityClick,
    onActivityDoubleClick,
  ]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 1.5);
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 0.67);
  }, []);

  const handleFitToScreen = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.transform, d3.zoomIdentity);
  }, []);

  const handleGoToToday = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    const today = new Date();
    const chartWidth = dimensions.width - LABEL_WIDTH - PADDING.left - PADDING.right;
    const todayX = xScale(today);
    const translateX = chartWidth / 2 - todayX;

    d3.select(svgRef.current)
      .transition()
      .duration(500)
      .call(zoomRef.current.transform, d3.zoomIdentity.translate(translateX, 0));
  }, [dimensions.width, xScale]);

  // Stats
  const stats = useMemo(() => {
    const total = processedActivities.length;
    const critical = processedActivities.filter((a) => a.isCritical).length;
    const completed = processedActivities.filter((a) => a.percentComplete === 100).length;
    const delayed = processedActivities.filter((a) => a.isDelayed).length;
    return { total, critical, completed, delayed };
  }, [processedActivities]);

  if (!activities || activities.length === 0) {
    return (
      <Paper
        sx={{
          p: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 300,
          bgcolor: '#F8FAFC',
        }}
      >
        <Typography color="text.secondary">No activities to display</Typography>
      </Paper>
    );
  }

  return (
    <Box ref={containerRef} sx={{ width: '100%', position: 'relative' }}>
      {/* Toolbar */}
      <Paper
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 1,
          mb: 1,
          bgcolor: '#F8FAFC',
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Tooltip title="Zoom In">
            <IconButton size="small" onClick={handleZoomIn}>
              <ZoomInIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Zoom Out">
            <IconButton size="small" onClick={handleZoomOut}>
              <ZoomOutIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Fit to Screen">
            <IconButton size="small" onClick={handleFitToScreen}>
              <FitScreenIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Go to Today">
            <IconButton size="small" onClick={handleGoToToday}>
              <TodayIcon />
            </IconButton>
          </Tooltip>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
          <Chip label={`${stats.total} Activities`} size="small" variant="outlined" />
          {stats.critical > 0 && (
            <Chip
              label={`${stats.critical} Critical`}
              size="small"
              sx={{ bgcolor: ganttColors.criticalPath, color: 'white' }}
            />
          )}
          {stats.completed > 0 && (
            <Chip
              label={`${stats.completed} Complete`}
              size="small"
              sx={{ bgcolor: statusColors.completed, color: 'white' }}
            />
          )}
          {stats.delayed > 0 && (
            <Chip
              label={`${stats.delayed} Delayed`}
              size="small"
              sx={{ bgcolor: statusColors.delayed, color: 'white' }}
            />
          )}
        </Stack>
      </Paper>

      {/* Chart */}
      <Paper sx={{ overflow: 'hidden', position: 'relative' }}>
        <Box sx={{ display: 'flex', height: chartHeight }}>
          {/* Fixed labels column */}
          <Box sx={{ width: LABEL_WIDTH, flexShrink: 0, overflow: 'hidden' }}>
            <svg
              ref={labelsSvgRef}
              width={LABEL_WIDTH}
              height={chartHeight}
              style={{ display: 'block' }}
            />
          </Box>

          {/* Scrollable chart area */}
          <Box sx={{ flex: 1, overflow: 'hidden' }}>
            <svg
              ref={svgRef}
              width={dimensions.width - LABEL_WIDTH}
              height={chartHeight}
              style={{ display: 'block', cursor: 'grab' }}
            />
          </Box>
        </Box>
      </Paper>

      {/* Legend */}
      <Paper sx={{ p: 1, mt: 1, display: 'flex', gap: 2, flexWrap: 'wrap', bgcolor: '#F8FAFC' }}>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Box sx={{ width: 16, height: 16, bgcolor: ganttColors.normalTask, borderRadius: 0.5 }} />
          <Typography variant="caption">Normal</Typography>
        </Stack>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Box
            sx={{
              width: 16,
              height: 16,
              bgcolor: ganttColors.criticalPath,
              borderRadius: 0.5,
              border: `2px solid ${ganttColors.criticalPath}`,
            }}
          />
          <Typography variant="caption">Critical Path</Typography>
        </Stack>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Box sx={{ width: 16, height: 16, bgcolor: statusColors.completed, borderRadius: 0.5 }} />
          <Typography variant="caption">Completed</Typography>
        </Stack>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Box sx={{ width: 16, height: 16, bgcolor: statusColors.atRisk, borderRadius: 0.5 }} />
          <Typography variant="caption">At Risk</Typography>
        </Stack>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Box sx={{ width: 16, height: 16, bgcolor: statusColors.delayed, borderRadius: 0.5 }} />
          <Typography variant="caption">Delayed</Typography>
        </Stack>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Box
            sx={{
              width: 16,
              height: 2,
              bgcolor: ganttColors.today,
              borderStyle: 'dashed',
            }}
          />
          <Typography variant="caption">Today</Typography>
        </Stack>
      </Paper>
    </Box>
  );
};

export default GanttChart;
