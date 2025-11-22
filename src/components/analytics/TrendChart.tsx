import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Text } from 'react-native-paper';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import { colors, spacing } from '../../../lib/design-system';

export interface DataPoint {
  label: string;
  value: number;
}

export interface TrendChartProps {
  data: DataPoint[];
  height?: number;
  width?: number;
  showLabels?: boolean;
  showDots?: boolean;
  lineColor?: string;
  dotColor?: string;
  gridColor?: string;
  labelColor?: string;
}

const { width: screenWidth } = Dimensions.get('window');

export const TrendChart = React.memo<TrendChartProps>(({
  data,
  height = 200,
  width = screenWidth - 32,
  showLabels = true,
  showDots = true,
  lineColor = colors.primary[600],
  dotColor = colors.primary[600],
  gridColor = colors.border.light,
  labelColor = colors.text.tertiary,
}) => {
  if (!data || data.length === 0) {
    return (
      <View style={[styles.container, { height }]}>
        <Text variant="bodyMedium" style={styles.noData}>
          No data available
        </Text>
      </View>
    );
  }

  const padding = { top: 20, right: 20, bottom: showLabels ? 40 : 20, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxValue = Math.max(...data.map(d => d.value), 1);
  const minValue = Math.min(...data.map(d => d.value), 0);
  const valueRange = maxValue - minValue || 1;

  const points = data.map((point, index) => {
    const x = padding.left + (index / (data.length - 1 || 1)) * chartWidth;
    const y = padding.top + chartHeight - ((point.value - minValue) / valueRange) * chartHeight;
    return { x, y, ...point };
  });

  const pathData = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  // Generate grid lines
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(ratio => {
    const y = padding.top + chartHeight * (1 - ratio);
    const value = minValue + valueRange * ratio;
    return { y, value };
  });

  return (
    <View style={[styles.container, { height, width }]}>
      <Svg width={width} height={height}>
        {/* Grid lines */}
        {gridLines.map((line, index) => (
          <React.Fragment key={`grid-${index}`}>
            <Line
              x1={padding.left}
              y1={line.y}
              x2={width - padding.right}
              y2={line.y}
              stroke={gridColor}
              strokeWidth="1"
              strokeDasharray="4,4"
            />
            <SvgText
              x={padding.left - 8}
              y={line.y + 4}
              fill={labelColor}
              fontSize="10"
              textAnchor="end"
            >
              {Math.round(line.value)}
            </SvgText>
          </React.Fragment>
        ))}

        {/* Trend line */}
        <Path d={pathData} stroke={lineColor} strokeWidth="2" fill="none" />

        {/* Data points */}
        {showDots &&
          points.map((point, index) => (
            <Circle
              key={`dot-${index}`}
              cx={point.x}
              cy={point.y}
              r="4"
              fill={dotColor}
              stroke={colors.surface.primary}
              strokeWidth="2"
            />
          ))}

        {/* Labels */}
        {showLabels &&
          points.map((point, index) => {
            // Only show labels for first, last, and middle points to avoid overcrowding
            const shouldShow =
              index === 0 || index === points.length - 1 || index === Math.floor(points.length / 2);
            if (!shouldShow) return null;

            return (
              <SvgText
                key={`label-${index}`}
                x={point.x}
                y={height - padding.bottom + 20}
                fill={labelColor}
                fontSize="10"
                textAnchor="middle"
              >
                {point.label.length > 8 ? point.label.substring(0, 8) + '...' : point.label}
              </SvgText>
            );
          })}
      </Svg>
    </View>
  );
}));

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface.primary,
    borderRadius: 8,
    padding: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noData: {
    color: colors.text.tertiary,
  },
});
