import { Box, Tooltip, Typography } from '@mui/material';
import {
  type TeamMember,
  type DayEntry,
  type OfficeEventInfo,
  DAY_LABELS,
  MONTH_NAMES,
  NAME_COL_WIDTH,
  DAY_COL_WIDTH,
  getDayOfWeek,
  formatCellTooltip,
  getCellColor,
  hasEventMarker,
} from '../pages/teamCalendarUtils';

interface MonthSpan {
  label: string;
  colStart: number;
  colSpan: number;
}

interface CalendarGridProps {
  dayEntries: DayEntry[];
  activeMembers: TeamMember[];
  holidaySet: Set<string>;
  holidayNameMap: Map<string, string>;
  officeEventDateMap: Map<string, OfficeEventInfo>;
  monthSpans: MonthSpan[];
}

export default function CalendarGrid({
  dayEntries,
  activeMembers,
  holidaySet,
  holidayNameMap,
  officeEventDateMap,
  monthSpans,
}: CalendarGridProps) {
  const totalDays = dayEntries.length;

  return (
    <Box
      component="table"
      sx={{
        borderCollapse: 'collapse',
        width: NAME_COL_WIDTH + totalDays * DAY_COL_WIDTH,
        tableLayout: 'fixed',
      }}
    >
      {/* Month label row */}
      <Box component="thead">
        <Box component="tr">
          <Box
            component="th"
            sx={{
              position: 'sticky',
              left: 0,
              zIndex: 3,
              bgcolor: 'background.default',
              width: NAME_COL_WIDTH,
              minWidth: NAME_COL_WIDTH,
            }}
          />
          {monthSpans.map((span) => (
            <Box
              component="th"
              key={`${span.label}-${span.colStart}`}
              colSpan={span.colSpan}
              sx={{
                textAlign: 'left',
                px: 0.5,
                py: 0.5,
                borderLeft: span.colStart > 0 ? '2px solid' : 'none',
                borderColor: 'divider',
                bgcolor: 'background.default',
              }}
            >
              <Typography
                variant="caption"
                sx={{ fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap' }}
              >
                {span.label}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Day number header row */}
        <Box component="tr">
          <Box
            component="th"
            sx={{
              position: 'sticky',
              left: 0,
              zIndex: 3,
              bgcolor: 'background.default',
              borderBottom: '2px solid',
              borderColor: 'divider',
              width: NAME_COL_WIDTH,
              minWidth: NAME_COL_WIDTH,
              textAlign: 'left',
              pl: 1,
              pb: 0.5,
              verticalAlign: 'bottom',
            }}
          >
            <Typography variant="caption" fontWeight={600}>
              Team Member
            </Typography>
          </Box>
          {dayEntries.map((entry, i) => {
            const isMonthBoundary = i > 0 && dayEntries[i - 1].month !== entry.month;
            const tip = formatCellTooltip(entry, holidayNameMap, officeEventDateMap);
            return (
              <Tooltip
                key={`hdr-${entry.dateKey}`}
                title={<span style={{ whiteSpace: 'pre-line' }}>{tip}</span>}
                arrow
                placement="bottom"
              >
                <Box
                  component="th"
                  sx={{
                    width: DAY_COL_WIDTH,
                    minWidth: DAY_COL_WIDTH,
                    borderBottom: '2px solid',
                    borderColor: 'divider',
                    borderLeft: isMonthBoundary ? '2px solid' : 'none',
                    textAlign: 'center',
                    verticalAlign: 'bottom',
                    pb: 0.5,
                    px: 0,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{ fontSize: 9, color: 'text.disabled', lineHeight: 1, display: 'block' }}
                  >
                    {DAY_LABELS[getDayOfWeek(entry.year, entry.month, entry.day)]}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ fontSize: 11, fontWeight: 600, lineHeight: 1.2, display: 'block' }}
                  >
                    {entry.day}
                  </Typography>
                </Box>
              </Tooltip>
            );
          })}
        </Box>
      </Box>

      {/* Data rows */}
      <Box component="tbody">
        {activeMembers.map((member) => (
          <Box component="tr" key={member.id}>
            <Box
              component="td"
              sx={{
                position: 'sticky',
                left: 0,
                zIndex: 1,
                bgcolor: 'background.default',
                pl: 1,
                height: DAY_COL_WIDTH,
                borderBottom: '1px solid',
                borderColor: 'divider',
                width: NAME_COL_WIDTH,
                minWidth: NAME_COL_WIDTH,
                overflow: 'hidden',
                verticalAlign: 'middle',
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontSize: 11,
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: 'block',
                  maxWidth: NAME_COL_WIDTH - 16,
                }}
              >
                {member.full_name}
              </Typography>
            </Box>

            {dayEntries.map((entry, i) => {
              const tip = formatCellTooltip(entry, holidayNameMap, officeEventDateMap);
              const isMonthBoundary = i > 0 && dayEntries[i - 1].month !== entry.month;
              return (
                <Tooltip
                  key={`${member.id}-${entry.dateKey}`}
                  title={<span style={{ whiteSpace: 'pre-line' }}>{tip}</span>}
                  arrow
                  placement="top"
                >
                  <Box
                    component="td"
                    sx={{
                      height: DAY_COL_WIDTH,
                      width: DAY_COL_WIDTH,
                      minWidth: DAY_COL_WIDTH,
                      bgcolor: getCellColor(entry, holidaySet, officeEventDateMap),
                      borderBottom: '1px solid',
                      borderRight: '1px solid',
                      borderLeft: isMonthBoundary ? '2px solid' : 'none',
                      borderColor: 'rgba(0,0,0,0.08)',
                      p: 0,
                      position: 'relative',
                    }}
                  >
                    {hasEventMarker(entry, officeEventDateMap) && (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 2,
                          right: 2,
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          bgcolor: '#1E6FE9',
                        }}
                      />
                    )}
                  </Box>
                </Tooltip>
              );
            })}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
