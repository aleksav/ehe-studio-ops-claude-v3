import { useState, useCallback, useMemo } from 'react';
import {
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  FormControlLabel,
  IconButton,
  Menu,
  MenuItem,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import FlagIcon from '@mui/icons-material/Flag';
import PeopleIcon from '@mui/icons-material/People';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import ViewStreamIcon from '@mui/icons-material/ViewStream';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import AssigneeAvatars, { type Assignment } from './AssigneeAvatars';

// ---------------------------------------------------------------------------
// Types (exported for consumers)
// ---------------------------------------------------------------------------

export interface TeamMemberRef {
  id: string;
  full_name: string;
  email: string;
}

export interface TaskMilestoneRef {
  id: string;
  name: string;
}

export interface BoardTask {
  id: string;
  project_id: string;
  milestone_id: string | null;
  description: string;
  status: string;
  completed_at?: string | null;
  is_stale?: boolean;
  assignments?: Assignment[];
  milestone?: TaskMilestoneRef | null;
}

export interface BoardMilestone {
  id: string;
  project_id: string;
  name: string;
  due_date: string | null;
  is_overdue?: boolean;
}

export type ViewMode = 'board' | 'milestones' | 'people';

export interface SwimlaneData {
  id: string | null;
  name: string;
  due_date: string | null;
  is_overdue?: boolean;
  tasks: BoardTask[];
}

export interface PersonRowData {
  memberId: string | null;
  memberName: string;
  weeklyHours?: number;
  tasks: BoardTask[];
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ProjectTaskBoardProps {
  tasks: BoardTask[];
  milestones: BoardMilestone[];
  loading?: boolean;

  /** Weekly hours map (memberId -> hours) for People view. */
  weeklyHoursMap?: Record<string, number>;

  /** Filter Done tasks to only recently completed (last 7 days). */
  filterRecentDone?: boolean;

  // ---- View mode persistence ----
  /** Initial view mode. Defaults to 'board'. */
  initialViewMode?: ViewMode;
  /** Called when view mode changes (for external persistence). */
  onViewModeChange?: (mode: ViewMode) => void;

  // ---- Hide empty milestones ----
  /** Initial value for hide empty milestones toggle. */
  initialHideEmpty?: boolean;
  /** Called when the toggle changes (for external persistence). */
  onHideEmptyChange?: (checked: boolean) => void;

  // ---- Callbacks ----
  onAssignmentsChange?: (taskId: string, assignments: Assignment[]) => void;
  onMilestoneChange?: (taskId: string, milestoneId: string | null) => void;

  // ---- Status change (standup: button + drag) ----
  onStatusChange?: (task: BoardTask) => void;

  // ---- Log time (standup) ----
  onLogTime?: (task: BoardTask) => void;

  // ---- Drag-and-drop callbacks ----
  /** Called when a task is dragged to a new status column. */
  onDropStatus?: (task: BoardTask, targetStatus: string) => void;
  /** Called when a task is dragged to a new milestone. */
  onDropMilestone?: (task: BoardTask, targetMilestoneId: string | null) => void;
  /** Called when a task is dragged to a new person. */
  onDropPerson?: (task: BoardTask, targetMemberId: string | null) => void;

  // ---- Milestone CRUD (project detail) ----
  onEditMilestone?: (milestone: BoardMilestone) => void;
  onDeleteMilestone?: (milestone: BoardMilestone) => void;

  // ---- Per-milestone visibility (project detail) ----
  /** Set of milestone IDs (or '__none__') that are manually hidden. */
  hiddenMilestoneIds?: Set<string>;
  onToggleMilestoneVisibility?: (milestoneId: string | null) => void;
  onShowAllMilestones?: () => void;

  // ---- Extra content slots ----
  /** Rendered above the board (between view toggle and task views). */
  headerSlot?: React.ReactNode;

  /** Cancelled task count to show below board/milestones view. */
  cancelledCount?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TASK_STATUS_COLOR: Record<string, 'default' | 'info' | 'success' | 'warning'> = {
  TODO: 'default',
  IN_PROGRESS: 'info',
  DONE: 'success',
  CANCELLED: 'warning',
};

const TASK_STATUS_LABEL: Record<string, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
};

const NEXT_STATUS_LABEL: Record<string, string> = {
  TODO: 'Start (move to In Progress)',
  IN_PROGRESS: 'Complete (move to Done)',
  DONE: 'Reopen (move to To Do)',
};

const PERSON_HEADER_COLOR = '#1976D2';

// ---------------------------------------------------------------------------
// Milestone color coding
// ---------------------------------------------------------------------------

function getMilestoneColor(dueDate: string | null): {
  border: string;
  bg: string;
  label: string;
} {
  if (!dueDate) {
    return { border: '#bdbdbd', bg: 'rgba(189,189,189,0.05)', label: '' };
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const absDays = Math.abs(diffDays);
    return {
      border: '#d32f2f',
      bg: 'rgba(211,47,47,0.05)',
      label: `Overdue by ${absDays} day${absDays === 1 ? '' : 's'}`,
    };
  }
  if (diffDays === 0) {
    return { border: '#d32f2f', bg: 'rgba(211,47,47,0.05)', label: 'Due today' };
  }
  if (diffDays <= 7) {
    return {
      border: '#e65100',
      bg: 'rgba(230,81,0,0.05)',
      label: `${diffDays} day${diffDays === 1 ? '' : 's'} left`,
    };
  }
  if (diffDays <= 14) {
    return {
      border: '#f57c00',
      bg: 'rgba(245,124,0,0.05)',
      label: `${diffDays} days left`,
    };
  }
  if (diffDays <= 30) {
    return {
      border: '#ffa000',
      bg: 'rgba(255,160,0,0.05)',
      label: `${diffDays} days left`,
    };
  }
  if (diffDays <= 60) {
    const weeks = Math.round(diffDays / 7);
    return {
      border: '#7cb342',
      bg: 'rgba(124,179,66,0.05)',
      label: `${weeks} week${weeks === 1 ? '' : 's'} left`,
    };
  }
  const months = Math.round(diffDays / 30);
  return {
    border: '#a5d6a7',
    bg: 'rgba(165,214,167,0.05)',
    label: `${months} month${months === 1 ? '' : 's'} left`,
  };
}

// ---------------------------------------------------------------------------
// Helper: recently completed filter
// ---------------------------------------------------------------------------

function isRecentlyCompleted(task: BoardTask): boolean {
  if (!task.completed_at) return true;
  const completedDate = new Date(task.completed_at);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return completedDate >= sevenDaysAgo;
}

// ---------------------------------------------------------------------------
// TaskCard Component
// ---------------------------------------------------------------------------

function TaskCard({
  task,
  milestones,
  onAssignmentsChange,
  onMilestoneChange,
  onStatusChange,
  onLogTime,
  draggable,
  onDragStart,
}: {
  task: BoardTask;
  milestones?: BoardMilestone[];
  onAssignmentsChange?: (taskId: string, assignments: Assignment[]) => void;
  onMilestoneChange?: (taskId: string, milestoneId: string | null) => void;
  onStatusChange?: (task: BoardTask) => void;
  onLogTime?: (task: BoardTask) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent, task: BoardTask) => void;
}) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMilestoneClick = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
  };

  const handleMilestoneSelect = (milestoneId: string | null) => {
    setAnchorEl(null);
    if (onMilestoneChange) {
      onMilestoneChange(task.id, milestoneId);
    }
  };

  return (
    <Card
      elevation={0}
      draggable={draggable}
      onDragStart={draggable && onDragStart ? (e) => onDragStart(e, task) : undefined}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        cursor: draggable ? 'grab' : undefined,
        '&:active': draggable ? { cursor: 'grabbing' } : undefined,
        '&[draggable]:hover': draggable ? { boxShadow: 2 } : undefined,
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 500,
            mb: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: onStatusChange ? 2 : 3,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {task.description}
        </Typography>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
            <Chip
              label={TASK_STATUS_LABEL[task.status] ?? task.status}
              size="small"
              color={TASK_STATUS_COLOR[task.status] ?? 'default'}
              sx={{ fontSize: 11, height: 22 }}
            />
            {task.is_stale && (
              <Chip
                icon={<AccessTimeIcon sx={{ fontSize: 14 }} />}
                label="Stale"
                size="small"
                sx={{
                  fontSize: 11,
                  height: 22,
                  bgcolor: '#FFF3E0',
                  color: '#E65100',
                  '& .MuiChip-icon': { color: '#E65100' },
                }}
              />
            )}
            {onMilestoneChange && milestones ? (
              <>
                <Chip
                  icon={<FlagIcon sx={{ fontSize: 13 }} />}
                  label={task.milestone ? task.milestone.name : 'No milestone'}
                  size="small"
                  variant="outlined"
                  onClick={handleMilestoneClick}
                  sx={{
                    fontSize: 10,
                    height: 20,
                    cursor: 'pointer',
                    '& .MuiChip-icon': { fontSize: 13 },
                  }}
                />
                <Menu
                  anchorEl={anchorEl}
                  open={Boolean(anchorEl)}
                  onClose={() => setAnchorEl(null)}
                  slotProps={{ paper: { sx: { maxHeight: 300 } } }}
                >
                  <MenuItem
                    selected={!task.milestone_id}
                    onClick={() => handleMilestoneSelect(null)}
                  >
                    <Typography variant="body2" color="text.secondary">
                      No milestone
                    </Typography>
                  </MenuItem>
                  {milestones.map((m) => (
                    <MenuItem
                      key={m.id}
                      selected={task.milestone_id === m.id}
                      onClick={() => handleMilestoneSelect(m.id)}
                    >
                      {m.name}
                    </MenuItem>
                  ))}
                </Menu>
              </>
            ) : (
              task.milestone && (
                <Chip
                  icon={<FlagIcon sx={{ fontSize: 13 }} />}
                  label={task.milestone.name}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: 10, height: 20, '& .MuiChip-icon': { fontSize: 13 } }}
                />
              )
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {onAssignmentsChange && (
              <AssigneeAvatars
                taskId={task.id}
                assignments={task.assignments ?? []}
                onAssignmentsChange={onAssignmentsChange}
              />
            )}
            {onLogTime && (
              <Tooltip title="Log Time">
                <IconButton size="small" onClick={() => onLogTime(task)}>
                  <AccessTimeIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            )}
            {onStatusChange && (
              <Tooltip title={NEXT_STATUS_LABEL[task.status] ?? 'Change status'}>
                <IconButton size="small" onClick={() => onStatusChange(task)} color="primary">
                  <ArrowForwardIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// StatusColumns: three-column layout used by Board, Milestones, People views
// ---------------------------------------------------------------------------

function StatusColumns({
  todoTasks,
  inProgressTasks,
  doneTasks,
  milestones,
  onAssignmentsChange,
  onMilestoneChange,
  onStatusChange,
  onLogTime,
  draggable,
  onDragStartTask,
  dragOverStatus,
  onDragOverStatus,
  onDragLeaveStatus,
  onDropTaskStatus,
  doneLabel,
}: {
  todoTasks: BoardTask[];
  inProgressTasks: BoardTask[];
  doneTasks: BoardTask[];
  milestones?: BoardMilestone[];
  onAssignmentsChange?: (taskId: string, assignments: Assignment[]) => void;
  onMilestoneChange?: (taskId: string, milestoneId: string | null) => void;
  onStatusChange?: (task: BoardTask) => void;
  onLogTime?: (task: BoardTask) => void;
  draggable?: boolean;
  onDragStartTask?: (e: React.DragEvent, task: BoardTask) => void;
  dragOverStatus?: string | null;
  onDragOverStatus?: (e: React.DragEvent, status: string) => void;
  onDragLeaveStatus?: () => void;
  onDropTaskStatus?: (e: React.DragEvent, targetStatus: string) => void;
  doneLabel?: string;
}) {
  const columns = [
    { status: 'TODO', title: 'TODO', tasks: todoTasks, color: '#F5F5F5' },
    { status: 'IN_PROGRESS', title: 'In Progress', tasks: inProgressTasks, color: '#E3F2FD' },
    { status: 'DONE', title: doneLabel ?? 'Done', tasks: doneTasks, color: '#E8F5E9' },
  ];

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        gap: 3,
      }}
    >
      {columns.map(({ status, title, tasks, color: bgColor }) => {
        const isDragOver = dragOverStatus === status;

        return (
          <Box
            key={status}
            sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}
            onDragOver={
              onDragOverStatus
                ? (e) => {
                    e.stopPropagation();
                    onDragOverStatus(e, status);
                  }
                : undefined
            }
            onDragLeave={
              onDragLeaveStatus
                ? (e) => {
                    e.stopPropagation();
                    onDragLeaveStatus();
                  }
                : undefined
            }
            onDrop={
              onDropTaskStatus
                ? (e) => {
                    e.stopPropagation();
                    onDropTaskStatus(e, status);
                  }
                : undefined
            }
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, px: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {title}
              </Typography>
              <Chip label={tasks.length} size="small" sx={{ fontSize: 12, height: 22 }} />
            </Box>
            <Box
              sx={{
                bgcolor: bgColor,
                borderRadius: 2,
                p: 1.5,
                minHeight: draggable ? 60 : 120,
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
                border: isDragOver ? '2px dashed' : '2px dashed transparent',
                borderColor: isDragOver ? 'primary.main' : 'transparent',
                transition: 'border-color 0.2s, background-color 0.2s',
              }}
            >
              {tasks.length === 0 ? (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ textAlign: 'center', py: draggable ? 1 : 3 }}
                >
                  {isDragOver ? 'Drop here to change status' : 'No tasks'}
                </Typography>
              ) : (
                tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    milestones={milestones}
                    onAssignmentsChange={onAssignmentsChange}
                    onMilestoneChange={onMilestoneChange}
                    onStatusChange={onStatusChange}
                    onLogTime={onLogTime}
                    draggable={draggable}
                    onDragStart={onDragStartTask}
                  />
                ))
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// MilestoneSwimlane Component
// ---------------------------------------------------------------------------

function MilestoneSwimlane({
  swimlane,
  allMilestones,
  onAssignmentsChange,
  onMilestoneChange,
  onStatusChange,
  onLogTime,
  onEditMilestone,
  onDeleteMilestone,
  isManuallyHidden,
  onToggleVisibility,
  draggable,
  onDragStartTask,
  dragOverLaneId,
  onDragOver,
  onDragLeave,
  onDropTask,
  dragOverStatus,
  onDragOverStatus,
  onDragLeaveStatus,
  onDropTaskStatus,
}: {
  swimlane: SwimlaneData;
  allMilestones?: BoardMilestone[];
  onAssignmentsChange?: (taskId: string, assignments: Assignment[]) => void;
  onMilestoneChange?: (taskId: string, milestoneId: string | null) => void;
  onStatusChange?: (task: BoardTask) => void;
  onLogTime?: (task: BoardTask) => void;
  onEditMilestone?: (milestone: BoardMilestone) => void;
  onDeleteMilestone?: (milestone: BoardMilestone) => void;
  isManuallyHidden?: boolean;
  onToggleVisibility?: (swimlaneId: string | null) => void;
  draggable?: boolean;
  onDragStartTask?: (e: React.DragEvent, task: BoardTask) => void;
  dragOverLaneId?: string | null | undefined;
  onDragOver?: (e: React.DragEvent, milestoneId: string | null) => void;
  onDragLeave?: () => void;
  onDropTask?: (e: React.DragEvent, targetMilestoneId: string | null) => void;
  dragOverStatus?: string | null;
  onDragOverStatus?: (e: React.DragEvent, status: string) => void;
  onDragLeaveStatus?: () => void;
  onDropTaskStatus?: (e: React.DragEvent, targetStatus: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  const todoTasks = swimlane.tasks.filter((t) => t.status === 'TODO');
  const inProgressTasks = swimlane.tasks.filter((t) => t.status === 'IN_PROGRESS');
  const doneTasks = swimlane.tasks.filter((t) => t.status === 'DONE');
  const totalCount = todoTasks.length + inProgressTasks.length + doneTasks.length;

  const milestone =
    swimlane.id && allMilestones ? allMilestones.find((m) => m.id === swimlane.id) : undefined;

  const milestoneColor = swimlane.id ? getMilestoneColor(swimlane.due_date) : null;

  const laneKey = swimlane.id ?? '__none__';
  const isDragOver = dragOverLaneId === laneKey;

  return (
    <Box
      sx={{ mb: 3 }}
      onDragOver={onDragOver ? (e) => onDragOver(e, swimlane.id) : undefined}
      onDragLeave={onDragLeave}
      onDrop={onDropTask ? (e) => onDropTask(e, swimlane.id) : undefined}
    >
      {/* Swimlane Header */}
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          p: 1.5,
          borderLeft: milestoneColor
            ? `5px solid ${milestoneColor.border}`
            : swimlane.is_overdue
              ? '4px solid #f44336'
              : swimlane.id
                ? '4px solid #1976d2'
                : '4px solid #E91E63',
          borderRadius: 1,
          bgcolor: isDragOver
            ? 'action.hover'
            : milestoneColor
              ? milestoneColor.bg
              : swimlane.is_overdue
                ? '#FFEBEE'
                : 'grey.50',
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'background-color 0.2s',
          '&:hover': { bgcolor: 'grey.100' },
        }}
      >
        {expanded ? (
          <ExpandLessIcon fontSize="small" color="action" />
        ) : (
          <ExpandMoreIcon fontSize="small" color="action" />
        )}
        <Typography variant={onStatusChange ? 'subtitle2' : 'subtitle1'} sx={{ fontWeight: 600 }}>
          {swimlane.name}
        </Typography>
        {swimlane.due_date && (
          <Typography variant={onStatusChange ? 'caption' : 'body2'} color="text.secondary">
            Due {new Date(swimlane.due_date).toLocaleDateString()}
          </Typography>
        )}
        {milestoneColor && milestoneColor.label && (
          <Chip
            label={milestoneColor.label}
            size="small"
            sx={{
              fontSize: 11,
              height: 22,
              bgcolor: milestoneColor.border,
              color: '#fff',
              fontWeight: 500,
            }}
          />
        )}
        {swimlane.is_overdue && !milestoneColor && (
          <Chip label="Overdue" size="small" color="error" sx={{ fontSize: 11, height: 22 }} />
        )}
        {milestone && onEditMilestone && (
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onEditMilestone(milestone);
            }}
            sx={{ ml: 0.5 }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        )}
        {milestone && onDeleteMilestone && (
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteMilestone(milestone);
            }}
            color="error"
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        )}
        {onToggleVisibility && (
          <Tooltip title={isManuallyHidden ? 'Show milestone' : 'Hide milestone'}>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onToggleVisibility(swimlane.id);
              }}
              sx={{ ml: 0.5 }}
            >
              {isManuallyHidden ? (
                <VisibilityOffIcon fontSize="small" />
              ) : (
                <VisibilityIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
        )}
        <Chip label={totalCount} size="small" sx={{ fontSize: 12, height: 22, ml: 'auto' }} />
      </Box>

      {/* Swimlane Content */}
      <Collapse in={expanded}>
        <Box
          sx={{
            mt: 2,
            pl: 2,
            minHeight: draggable ? 40 : undefined,
            border: isDragOver ? '2px dashed' : '2px dashed transparent',
            borderColor: isDragOver ? 'primary.main' : 'transparent',
            borderRadius: 1,
            transition: 'border-color 0.2s',
          }}
        >
          {totalCount === 0 && !isDragOver ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
              No tasks
            </Typography>
          ) : (
            <StatusColumns
              todoTasks={todoTasks}
              inProgressTasks={inProgressTasks}
              doneTasks={doneTasks}
              milestones={allMilestones}
              onAssignmentsChange={onAssignmentsChange}
              onMilestoneChange={onMilestoneChange}
              onStatusChange={onStatusChange}
              onLogTime={onLogTime}
              draggable={draggable}
              onDragStartTask={onDragStartTask}
              dragOverStatus={dragOverStatus}
              onDragOverStatus={onDragOverStatus}
              onDragLeaveStatus={onDragLeaveStatus}
              onDropTaskStatus={onDropTaskStatus}
            />
          )}
        </Box>
      </Collapse>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// PeopleBoardRow Component
// ---------------------------------------------------------------------------

function PeopleBoardRow({
  row,
  milestones,
  onAssignmentsChange,
  onMilestoneChange,
  onStatusChange,
  onLogTime,
  draggable,
  onDragStartTask,
  dragOverRowId,
  onDragOver,
  onDragLeave,
  onDropTask,
  dragOverStatus,
  onDragOverStatus,
  onDragLeaveStatus,
  onDropTaskStatus,
}: {
  row: PersonRowData;
  milestones?: BoardMilestone[];
  onAssignmentsChange?: (taskId: string, assignments: Assignment[]) => void;
  onMilestoneChange?: (taskId: string, milestoneId: string | null) => void;
  onStatusChange?: (task: BoardTask) => void;
  onLogTime?: (task: BoardTask) => void;
  draggable?: boolean;
  onDragStartTask?: (e: React.DragEvent, task: BoardTask) => void;
  dragOverRowId?: string | null | undefined;
  onDragOver?: (e: React.DragEvent, memberId: string | null) => void;
  onDragLeave?: () => void;
  onDropTask?: (e: React.DragEvent, targetMemberId: string | null) => void;
  dragOverStatus?: string | null;
  onDragOverStatus?: (e: React.DragEvent, status: string) => void;
  onDragLeaveStatus?: () => void;
  onDropTaskStatus?: (e: React.DragEvent, targetStatus: string) => void;
}) {
  const todoTasks = row.tasks.filter((t) => t.status === 'TODO');
  const inProgressTasks = row.tasks.filter((t) => t.status === 'IN_PROGRESS');
  const doneTasks = row.tasks.filter((t) => t.status === 'DONE');
  const initial = row.memberName.charAt(0).toUpperCase();

  const rowKey = row.memberId ?? '__unassigned__';
  const isDragOver = dragOverRowId === rowKey;

  return (
    <Box
      sx={{ mb: 3 }}
      onDragOver={onDragOver ? (e) => onDragOver(e, row.memberId) : undefined}
      onDragLeave={onDragLeave}
      onDrop={onDropTask ? (e) => onDropTask(e, row.memberId) : undefined}
    >
      {/* Row header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          mb: 1.5,
          px: 1,
          p: draggable ? 1 : undefined,
          borderRadius: 1,
          bgcolor: isDragOver ? 'action.hover' : 'transparent',
          transition: 'background-color 0.2s',
        }}
      >
        <Avatar
          sx={{
            width: draggable ? 28 : 32,
            height: draggable ? 28 : 32,
            fontSize: draggable ? 13 : 14,
            fontWeight: 700,
            bgcolor: row.memberId ? (draggable ? '#1565C0' : PERSON_HEADER_COLOR) : '#757575',
            color: '#fff',
          }}
        >
          {initial}
        </Avatar>
        <Typography
          variant={draggable ? 'subtitle2' : 'subtitle1'}
          sx={{ fontWeight: 600, color: draggable ? undefined : PERSON_HEADER_COLOR }}
        >
          {row.memberName}
        </Typography>
        {row.memberId && row.weeklyHours != null && row.weeklyHours > 0 && (
          <Chip
            label={`${row.weeklyHours.toFixed(1)}h this week`}
            size="small"
            sx={{
              fontSize: 11,
              height: 22,
              bgcolor: '#E3F2FD',
              color: PERSON_HEADER_COLOR,
              fontWeight: 600,
            }}
          />
        )}
        <Chip
          label={`${row.tasks.length} task${row.tasks.length === 1 ? '' : 's'}`}
          size="small"
          sx={{ fontSize: 11, height: 22 }}
        />
      </Box>

      {/* Three columns */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 2,
          pl: draggable ? 1 : undefined,
          border: isDragOver ? '2px dashed' : '2px dashed transparent',
          borderColor: isDragOver ? 'primary.main' : 'transparent',
          borderRadius: 1,
          transition: 'border-color 0.2s',
        }}
      >
        {(['TODO', 'IN_PROGRESS', 'DONE'] as const).map((status) => {
          const statusTasks =
            status === 'TODO' ? todoTasks : status === 'IN_PROGRESS' ? inProgressTasks : doneTasks;
          const bgColor =
            status === 'IN_PROGRESS' ? '#E3F2FD' : status === 'DONE' ? '#E8F5E9' : '#F5F5F5';
          const label =
            status === 'TODO' ? 'TODO' : status === 'IN_PROGRESS' ? 'In Progress' : 'Done';
          const isStatusDragOver = dragOverStatus === status;

          return (
            <Box
              key={status}
              sx={{ flex: 1, minWidth: 0 }}
              onDragOver={
                onDragOverStatus
                  ? (e) => {
                      e.stopPropagation();
                      onDragOverStatus(e, status);
                    }
                  : undefined
              }
              onDragLeave={
                onDragLeaveStatus
                  ? (e) => {
                      e.stopPropagation();
                      onDragLeaveStatus();
                    }
                  : undefined
              }
              onDrop={
                onDropTaskStatus
                  ? (e) => {
                      e.stopPropagation();
                      onDropTaskStatus(e, status);
                    }
                  : undefined
              }
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  mb: draggable ? 0.5 : 1,
                  px: 0.5,
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                  {label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  ({statusTasks.length})
                </Typography>
              </Box>
              <Box
                sx={{
                  bgcolor: bgColor,
                  borderRadius: 1.5,
                  p: 1,
                  minHeight: draggable ? 40 : 60,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                  border: isStatusDragOver ? '2px dashed' : '2px dashed transparent',
                  borderColor: isStatusDragOver ? 'primary.main' : 'transparent',
                  transition: 'border-color 0.2s',
                }}
              >
                {statusTasks.length === 0 ? (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ textAlign: 'center', py: 1.5 }}
                  >
                    {isStatusDragOver ? 'Drop here' : '--'}
                  </Typography>
                ) : (
                  statusTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      milestones={milestones}
                      onAssignmentsChange={onAssignmentsChange}
                      onMilestoneChange={onMilestoneChange}
                      onStatusChange={onStatusChange}
                      onLogTime={onLogTime}
                      draggable={draggable}
                      onDragStart={onDragStartTask}
                    />
                  ))
                )}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Main Component: ProjectTaskBoard
// ---------------------------------------------------------------------------

export default function ProjectTaskBoard({
  tasks,
  milestones,
  loading,
  weeklyHoursMap,
  filterRecentDone,
  initialViewMode = 'board',
  onViewModeChange,
  initialHideEmpty = false,
  onHideEmptyChange: onHideEmptyChangeProp,
  onAssignmentsChange,
  onMilestoneChange,
  onStatusChange,
  onLogTime,
  onDropStatus,
  onDropMilestone,
  onDropPerson,
  onEditMilestone,
  onDeleteMilestone,
  hiddenMilestoneIds,
  onToggleMilestoneVisibility,
  onShowAllMilestones,
  headerSlot,
  cancelledCount,
}: ProjectTaskBoardProps) {
  // ---- View mode ----
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);

  const handleViewChange = (_: React.MouseEvent<HTMLElement>, newView: ViewMode | null) => {
    if (newView !== null) {
      setViewMode(newView);
      onViewModeChange?.(newView);
    }
  };

  // ---- Hide empty milestones ----
  const [hideEmptyMilestones, setHideEmptyMilestones] = useState(initialHideEmpty);

  const handleHideEmptyChange = (checked: boolean) => {
    setHideEmptyMilestones(checked);
    onHideEmptyChangeProp?.(checked);
  };

  // ---- Drag-and-drop state ----
  const [draggedTask, setDraggedTask] = useState<BoardTask | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const [dragOverMilestone, setDragOverMilestone] = useState<string | null | undefined>(undefined);
  const [dragOverPerson, setDragOverPerson] = useState<string | null | undefined>(undefined);

  const hasDragDrop = Boolean(onDropStatus || onDropMilestone || onDropPerson);

  // ---- Task lists ----
  const todoTasks = useMemo(() => tasks.filter((t) => t.status === 'TODO'), [tasks]);
  const inProgressTasks = useMemo(() => tasks.filter((t) => t.status === 'IN_PROGRESS'), [tasks]);
  const doneTasks = useMemo(
    () => tasks.filter((t) => t.status === 'DONE' && (!filterRecentDone || isRecentlyCompleted(t))),
    [tasks, filterRecentDone],
  );

  // ---- Milestone swimlanes ----
  const swimlanes = useMemo<SwimlaneData[]>(() => {
    const sorted = [...milestones].sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });

    const activeTasks = tasks.filter((t) => t.status !== 'CANCELLED');
    const lanes: SwimlaneData[] = sorted.map((m) => ({
      id: m.id,
      name: m.name,
      due_date: m.due_date,
      is_overdue: m.is_overdue,
      tasks: activeTasks.filter((t) => t.milestone_id === m.id),
    }));

    const unassigned = activeTasks.filter((t) => !t.milestone_id);
    if (unassigned.length > 0 || lanes.length > 0) {
      lanes.push({
        id: null,
        name: 'No Milestone',
        due_date: null,
        is_overdue: false,
        tasks: unassigned,
      });
    }

    return lanes;
  }, [tasks, milestones]);

  const filteredSwimlanes = useMemo(() => {
    return swimlanes.filter((lane) => {
      const laneKey = lane.id ?? '__none__';

      // Manually hidden
      if (hiddenMilestoneIds?.has(laneKey)) return false;

      // Hide empty: milestones with no TODO or IN_PROGRESS tasks
      if (hideEmptyMilestones) {
        const hasActiveTasks = lane.tasks.some(
          (t) => t.status === 'TODO' || t.status === 'IN_PROGRESS',
        );
        if (!hasActiveTasks) return false;
      }

      return true;
    });
  }, [swimlanes, hiddenMilestoneIds, hideEmptyMilestones]);

  const hiddenCount = swimlanes.length - filteredSwimlanes.length;
  const manuallyHiddenCount = hiddenMilestoneIds?.size ?? 0;

  // ---- People rows ----
  const personRows = useMemo<PersonRowData[]>(() => {
    const memberMap = new Map<string, { member: TeamMemberRef; tasks: BoardTask[] }>();
    const unassignedTasks: BoardTask[] = [];

    for (const task of tasks) {
      if (task.status === 'CANCELLED') continue;
      const assignments = task.assignments ?? [];
      if (assignments.length === 0) {
        unassignedTasks.push(task);
      } else {
        for (const assignment of assignments) {
          const memberId = assignment.team_member.id;
          if (!memberMap.has(memberId)) {
            memberMap.set(memberId, { member: assignment.team_member, tasks: [] });
          }
          memberMap.get(memberId)!.tasks.push(task);
        }
      }
    }

    const rows: PersonRowData[] = [];
    const sortedMembers = Array.from(memberMap.entries()).sort((a, b) =>
      a[1].member.full_name.localeCompare(b[1].member.full_name),
    );
    for (const [memberId, { member, tasks: memberTasks }] of sortedMembers) {
      rows.push({
        memberId,
        memberName: member.full_name,
        weeklyHours: weeklyHoursMap?.[memberId] ?? 0,
        tasks: memberTasks,
      });
    }
    if (unassignedTasks.length > 0) {
      rows.push({
        memberId: null,
        memberName: 'Unassigned',
        weeklyHours: 0,
        tasks: unassignedTasks,
      });
    }
    return rows;
  }, [tasks, weeklyHoursMap]);

  // ---- Drag-and-drop handlers ----
  const handleDragStart = useCallback((e: React.DragEvent, task: BoardTask) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id);
  }, []);

  // Board drag-drop
  const handleBoardDragOver = useCallback((e: React.DragEvent, status: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStatus(status);
  }, []);

  const handleBoardDragLeave = useCallback(() => {
    setDragOverStatus(null);
  }, []);

  const handleBoardDrop = useCallback(
    (e: React.DragEvent, targetStatus: string) => {
      e.preventDefault();
      setDragOverStatus(null);
      if (!draggedTask || !onDropStatus) return;
      if (draggedTask.status === targetStatus) {
        setDraggedTask(null);
        return;
      }
      const task = draggedTask;
      setDraggedTask(null);
      onDropStatus(task, targetStatus);
    },
    [draggedTask, onDropStatus],
  );

  // Milestone drag-drop
  const handleMilestoneDragOver = useCallback((e: React.DragEvent, milestoneId: string | null) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverMilestone(milestoneId ?? '__none__');
  }, []);

  const handleMilestoneDragLeave = useCallback(() => {
    setDragOverMilestone(undefined);
  }, []);

  const handleMilestoneDrop = useCallback(
    (e: React.DragEvent, targetMilestoneId: string | null) => {
      e.preventDefault();
      setDragOverMilestone(undefined);
      if (!draggedTask || !onDropMilestone) return;
      const currentMilestoneId = draggedTask.milestone_id ?? null;
      if (currentMilestoneId === targetMilestoneId) {
        setDraggedTask(null);
        return;
      }
      const task = draggedTask;
      setDraggedTask(null);
      onDropMilestone(task, targetMilestoneId);
    },
    [draggedTask, onDropMilestone],
  );

  // People drag-drop
  const handlePeopleDragOver = useCallback((e: React.DragEvent, memberId: string | null) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverPerson(memberId ?? '__unassigned__');
  }, []);

  const handlePeopleDragLeave = useCallback(() => {
    setDragOverPerson(undefined);
  }, []);

  const handlePeopleDrop = useCallback(
    (e: React.DragEvent, targetMemberId: string | null) => {
      e.preventDefault();
      setDragOverPerson(undefined);
      if (!draggedTask || !onDropPerson) return;
      const task = draggedTask;
      setDraggedTask(null);
      onDropPerson(task, targetMemberId);
    },
    [draggedTask, onDropPerson],
  );

  // Status drag-drop (used within milestone/people swimlanes)
  const handleSwimlaneStatusDragOver = useCallback((e: React.DragEvent, status: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStatus(status);
  }, []);

  const handleSwimlaneStatusDragLeave = useCallback(() => {
    setDragOverStatus(null);
  }, []);

  const handleSwimlaneStatusDrop = useCallback(
    (e: React.DragEvent, targetStatus: string) => {
      e.preventDefault();
      setDragOverStatus(null);
      if (!draggedTask || !onDropStatus) return;
      if (draggedTask.status === targetStatus) {
        setDraggedTask(null);
        return;
      }
      const task = draggedTask;
      setDraggedTask(null);
      onDropStatus(task, targetStatus);
    },
    [draggedTask, onDropStatus],
  );

  // ---- Render ----
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  const doneLabel = filterRecentDone ? 'Done (last 7 days)' : 'Done';
  const useViewStreamIcon = !onStatusChange;

  return (
    <Box>
      {/* View Toggle */}
      <Box
        sx={{ display: 'flex', justifyContent: onStatusChange ? 'center' : 'flex-start', mb: 2 }}
      >
        <ToggleButtonGroup value={viewMode} exclusive onChange={handleViewChange} size="small">
          <ToggleButton value="board" aria-label="Board view">
            <ViewColumnIcon sx={{ mr: 0.5, fontSize: 18 }} />
            Board
          </ToggleButton>
          <ToggleButton value="milestones" aria-label="Milestones view">
            {useViewStreamIcon ? (
              <ViewStreamIcon sx={{ mr: 0.5, fontSize: 18 }} />
            ) : (
              <FlagIcon sx={{ mr: 0.5, fontSize: 18 }} />
            )}
            Milestones
          </ToggleButton>
          <ToggleButton value="people" aria-label="People view">
            <PeopleIcon sx={{ mr: 0.5, fontSize: 18 }} />
            People
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {headerSlot}

      {/* Board View */}
      {viewMode === 'board' && (
        <>
          <StatusColumns
            todoTasks={todoTasks}
            inProgressTasks={inProgressTasks}
            doneTasks={doneTasks}
            milestones={milestones}
            onAssignmentsChange={onAssignmentsChange}
            onMilestoneChange={onMilestoneChange}
            onStatusChange={onStatusChange}
            onLogTime={onLogTime}
            draggable={hasDragDrop}
            onDragStartTask={hasDragDrop ? handleDragStart : undefined}
            dragOverStatus={dragOverStatus}
            onDragOverStatus={onDropStatus ? handleBoardDragOver : undefined}
            onDragLeaveStatus={onDropStatus ? handleBoardDragLeave : undefined}
            onDropTaskStatus={onDropStatus ? handleBoardDrop : undefined}
            doneLabel={doneLabel}
          />
          {cancelledCount != null && cancelledCount > 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              {cancelledCount} cancelled {cancelledCount === 1 ? 'task' : 'tasks'}
            </Typography>
          )}
        </>
      )}

      {/* Milestones View */}
      {viewMode === 'milestones' && (
        <>
          {/* Milestone filter bar */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              mb: 2,
              flexWrap: 'wrap',
              justifyContent: onStatusChange ? 'flex-end' : 'flex-start',
            }}
          >
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={hideEmptyMilestones}
                  onChange={(e) => handleHideEmptyChange(e.target.checked)}
                />
              }
              label={
                <Typography variant="body2" color="text.secondary">
                  Show only active milestones
                </Typography>
              }
              sx={{ mr: 2 }}
            />
            {manuallyHiddenCount > 0 && onShowAllMilestones && (
              <Chip
                label={`${manuallyHiddenCount} milestone${manuallyHiddenCount === 1 ? '' : 's'} hidden`}
                size="small"
                variant="outlined"
                onClick={onShowAllMilestones}
                onDelete={onShowAllMilestones}
                deleteIcon={<VisibilityIcon fontSize="small" />}
                sx={{ fontSize: 12, height: 26 }}
              />
            )}
            {!onShowAllMilestones && hiddenCount > 0 && (
              <Typography variant="caption" color="text.secondary">
                ({hiddenCount} hidden)
              </Typography>
            )}
          </Box>
          {filteredSwimlanes.length === 0 && swimlanes.length > 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              {onShowAllMilestones ? (
                <>
                  All milestones are hidden.{' '}
                  <Box
                    component="span"
                    onClick={onShowAllMilestones}
                    sx={{
                      color: 'primary.main',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    Show all
                  </Box>
                </>
              ) : (
                'No milestones or tasks to display.'
              )}
            </Typography>
          ) : filteredSwimlanes.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              No milestones or tasks to display.
            </Typography>
          ) : (
            filteredSwimlanes.map((lane) => (
              <MilestoneSwimlane
                key={lane.id ?? '__none__'}
                swimlane={lane}
                allMilestones={milestones}
                onAssignmentsChange={onAssignmentsChange}
                onMilestoneChange={onMilestoneChange}
                onStatusChange={onStatusChange}
                onLogTime={onLogTime}
                onEditMilestone={onEditMilestone}
                onDeleteMilestone={onDeleteMilestone}
                isManuallyHidden={hiddenMilestoneIds?.has(lane.id ?? '__none__')}
                onToggleVisibility={onToggleMilestoneVisibility}
                draggable={hasDragDrop}
                onDragStartTask={hasDragDrop ? handleDragStart : undefined}
                dragOverLaneId={dragOverMilestone}
                onDragOver={onDropMilestone ? handleMilestoneDragOver : undefined}
                onDragLeave={onDropMilestone ? handleMilestoneDragLeave : undefined}
                onDropTask={onDropMilestone ? handleMilestoneDrop : undefined}
                dragOverStatus={dragOverStatus}
                onDragOverStatus={onDropStatus ? handleSwimlaneStatusDragOver : undefined}
                onDragLeaveStatus={onDropStatus ? handleSwimlaneStatusDragLeave : undefined}
                onDropTaskStatus={onDropStatus ? handleSwimlaneStatusDrop : undefined}
              />
            ))
          )}
          {hiddenCount > 0 && filteredSwimlanes.length > 0 && onShowAllMilestones && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 1 }}>
              {hiddenCount} milestone{hiddenCount === 1 ? '' : 's'} hidden
            </Typography>
          )}
          {cancelledCount != null && cancelledCount > 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              {cancelledCount} cancelled {cancelledCount === 1 ? 'task' : 'tasks'}
            </Typography>
          )}
        </>
      )}

      {/* People View */}
      {viewMode === 'people' && (
        <>
          {personRows.length === 0 ? (
            <Typography variant="body1" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              No tasks to display.
            </Typography>
          ) : (
            personRows.map((row) => (
              <PeopleBoardRow
                key={row.memberId ?? 'unassigned'}
                row={row}
                milestones={milestones}
                onAssignmentsChange={onAssignmentsChange}
                onMilestoneChange={onMilestoneChange}
                onStatusChange={onStatusChange}
                onLogTime={onLogTime}
                draggable={hasDragDrop}
                onDragStartTask={hasDragDrop ? handleDragStart : undefined}
                dragOverRowId={dragOverPerson}
                onDragOver={onDropPerson ? handlePeopleDragOver : undefined}
                onDragLeave={onDropPerson ? handlePeopleDragLeave : undefined}
                onDropTask={onDropPerson ? handlePeopleDrop : undefined}
                dragOverStatus={dragOverStatus}
                onDragOverStatus={onDropStatus ? handleSwimlaneStatusDragOver : undefined}
                onDragLeaveStatus={onDropStatus ? handleSwimlaneStatusDragLeave : undefined}
                onDropTaskStatus={onDropStatus ? handleSwimlaneStatusDrop : undefined}
              />
            ))
          )}
          {cancelledCount != null && cancelledCount > 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              {cancelledCount} cancelled {cancelledCount === 1 ? 'task' : 'tasks'}
            </Typography>
          )}
        </>
      )}
    </Box>
  );
}
