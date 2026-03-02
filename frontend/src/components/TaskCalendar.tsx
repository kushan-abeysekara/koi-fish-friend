import React, { useState, useEffect } from 'react';
import { taskApi, type Task } from '../services/api';

interface LocalTask extends Omit<Task, 'dueDate' | 'createdDate' | 'completedDate' | 'snoozeUntil'> {
  dueDate: Date;
  createdDate: Date;
  completedDate?: Date;
  snoozeUntil?: Date;
}

type ViewMode = 'calendar' | 'list' | 'kanban';

const TaskCalendar: React.FC = () => {
  const [tasks, setTasks] = useState<LocalTask[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'in-progress' | 'completed' | 'snoozed'>('all');
  const [filterPriority, setFilterPriority] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<LocalTask | null>(null);
  const [showTaskDetail, setShowTaskDetail] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state for creating tasks
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium' as 'high' | 'medium' | 'low',
    type: 'maintenance' as 'calibration' | 'maintenance' | 'cleaning' | 'inspection' | 'treatment',
    dueDate: '',
    linkedParameter: '',
    autoCloseEnabled: true,
    assignedTo: '',
  });

  // Load tasks from API
  const loadTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await taskApi.getAll();
      if (response.success && response.data) {
        const localTasks: LocalTask[] = response.data.map(task => ({
          ...task,
          dueDate: new Date(task.dueDate),
          createdDate: new Date(task.createdDate),
          completedDate: task.completedDate ? new Date(task.completedDate) : undefined,
          snoozeUntil: task.snoozeUntil ? new Date(task.snoozeUntil) : undefined,
        }));
        setTasks(localTasks);
      } else {
        setError(response.message || 'Failed to load tasks');
      }
    } catch (err) {
      console.error('Error loading tasks:', err);
      setError('Failed to load tasks. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'border-red-500 bg-red-50 text-red-700';
      case 'medium':
        return 'border-yellow-500 bg-yellow-50 text-yellow-700';
      case 'low':
        return 'border-blue-500 bg-blue-50 text-blue-700';
      default:
        return 'border-gray-500 bg-gray-50 text-gray-700';
    }
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      high: 'bg-red-100 text-red-700',
      medium: 'bg-yellow-100 text-yellow-700',
      low: 'bg-blue-100 text-blue-700',
    };
    return (
      <span className={`px-2 py-1 ${colors[priority as keyof typeof colors]} rounded text-xs font-bold uppercase`}>
        {priority}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const config = {
      pending: { color: 'bg-gray-100 text-gray-700', icon: 'fa-clock' },
      'in-progress': { color: 'bg-blue-100 text-blue-700', icon: 'fa-spinner' },
      completed: { color: 'bg-green-100 text-green-700', icon: 'fa-check-circle' },
      snoozed: { color: 'bg-purple-100 text-purple-700', icon: 'fa-moon' },
    };
    const { color, icon } = config[status as keyof typeof config] || config.pending;
    return (
      <span className={`px-3 py-1 ${color} rounded-full text-xs font-semibold flex items-center gap-1`}>
        <i className={`fas ${icon}`}></i>
        {status.replace('-', ' ')}
      </span>
    );
  };

  const getTypeIcon = (type: string) => {
    const icons = {
      calibration: '⚗️',
      maintenance: '🔧',
      cleaning: '🧹',
      inspection: '🔍',
      treatment: '💊',
    };
    return icons[type as keyof typeof icons] || '📋';
  };

  const handleStatusChange = async (taskId: string, newStatus: 'in-progress' | 'completed') => {
    try {
      const response = await taskApi.update(taskId, { status: newStatus });
      if (response.success) {
        await loadTasks(); // Reload to get updated data
      } else {
        alert(response.message || 'Failed to update task status');
      }
    } catch (err) {
      console.error('Error updating task status:', err);
      alert('Failed to update task status');
    }
  };

  const handleSnooze = async (taskId: string, hours: number) => {
    try {
      const snoozeUntil = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
      const response = await taskApi.update(taskId, { 
        status: 'snoozed', 
        snoozeUntil 
      });
      if (response.success) {
        await loadTasks();
      } else {
        alert(response.message || 'Failed to snooze task');
      }
    } catch (err) {
      console.error('Error snoozing task:', err);
      alert('Failed to snooze task');
    }
  };

  const handleAddNote = async (taskId: string, note: string) => {
    if (!note.trim()) return;
    try {
      const response = await taskApi.addNote(taskId, note);
      if (response.success) {
        await loadTasks();
      } else {
        alert(response.message || 'Failed to add note');
      }
    } catch (err) {
      console.error('Error adding note:', err);
      alert('Failed to add note');
    }
  };

  const handleCreateTask = async () => {
    if (!formData.title.trim() || !formData.dueDate) {
      alert('Please fill in all required fields (Title and Due Date)');
      return;
    }

    try {
      const taskData = {
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        type: formData.type,
        status: 'pending' as const,
        dueDate: new Date(formData.dueDate).toISOString(),
        linkedParameter: formData.linkedParameter || undefined,
        autoCloseEnabled: formData.autoCloseEnabled,
        assignedTo: formData.assignedTo || undefined,
        notes: [],
      };

      const response = await taskApi.create(taskData);
      if (response.success) {
        setShowCreateModal(false);
        setFormData({
          title: '',
          description: '',
          priority: 'medium',
          type: 'maintenance',
          dueDate: '',
          linkedParameter: '',
          autoCloseEnabled: true,
          assignedTo: '',
        });
        await loadTasks();
      } else {
        alert(response.message || 'Failed to create task');
      }
    } catch (err) {
      console.error('Error creating task:', err);
      alert('Failed to create task');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    try {
      const response = await taskApi.delete(taskId);
      if (response.success) {
        await loadTasks();
        if (showTaskDetail) {
          setShowTaskDetail(false);
          setSelectedTask(null);
        }
      } else {
        alert(response.message || 'Failed to delete task');
      }
    } catch (err) {
      console.error('Error deleting task:', err);
      alert('Failed to delete task');
    }
  };

  const filteredTasks = tasks.filter(task => {
    const statusMatch = filterStatus === 'all' || task.status === filterStatus;
    const priorityMatch = filterPriority === 'all' || task.priority === filterPriority;
    return statusMatch && priorityMatch;
  });

  const getTasksForDate = (date: Date) => {
    return tasks.filter(task => {
      const taskDate = new Date(task.dueDate);
      return (
        taskDate.getDate() === date.getDate() &&
        taskDate.getMonth() === date.getMonth() &&
        taskDate.getFullYear() === date.getFullYear()
      );
    });
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const isOverdue = (date: Date) => {
    return date < new Date() && date.toDateString() !== new Date().toDateString();
  };

  const isToday = (date: Date) => {
    return date.toDateString() === new Date().toDateString();
  };

  // Kanban board columns
  const kanbanColumns = [
    { status: 'pending', title: 'To Do', color: 'bg-gray-100' },
    { status: 'in-progress', title: 'In Progress', color: 'bg-blue-100' },
    { status: 'snoozed', title: 'Snoozed', color: 'bg-purple-100' },
    { status: 'completed', title: 'Completed', color: 'bg-green-100' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-3xl">📅</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Task Calendar</h2>
              <p className="text-sm text-gray-500">Condition-Based Maintenance scheduling</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors font-semibold flex items-center gap-2"
          >
            <i className="fas fa-plus"></i>
            Create Task
          </button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <i className="fas fa-tasks text-gray-600"></i>
            </div>
            <div>
              <p className="text-xs text-gray-600">Total Tasks</p>
              <p className="text-xl font-bold text-gray-800">{tasks.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <i className="fas fa-exclamation-circle text-red-600"></i>
            </div>
            <div>
              <p className="text-xs text-gray-600">Overdue</p>
              <p className="text-xl font-bold text-gray-800">
                {tasks.filter(t => isOverdue(t.dueDate) && t.status !== 'completed').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <i className="fas fa-spinner text-blue-600"></i>
            </div>
            <div>
              <p className="text-xs text-gray-600">In Progress</p>
              <p className="text-xl font-bold text-gray-800">
                {tasks.filter(t => t.status === 'in-progress').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <i className="fas fa-fire text-yellow-600"></i>
            </div>
            <div>
              <p className="text-xs text-gray-600">High Priority</p>
              <p className="text-xl font-bold text-gray-800">
                {tasks.filter(t => t.priority === 'high' && t.status !== 'completed').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <i className="fas fa-check-circle text-green-600"></i>
            </div>
            <div>
              <p className="text-xs text-gray-600">Completed</p>
              <p className="text-xl font-bold text-gray-800">
                {tasks.filter(t => t.status === 'completed').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Loading/Error State */}
      {loading && (
        <div className="bg-white rounded-xl shadow-sm p-12 border border-gray-100 text-center">
          <i className="fas fa-spinner fa-spin text-4xl text-cyan-500 mb-4"></i>
          <p className="text-gray-600">Loading tasks...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <i className="fas fa-exclamation-circle text-red-500 text-xl"></i>
            <div>
              <p className="font-semibold text-red-800">Error Loading Tasks</p>
              <p className="text-sm text-red-600">{error}</p>
            </div>
            <button 
              onClick={loadTasks}
              className="ml-auto px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* View Mode & Filters */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <i className="fas fa-eye mr-2"></i>View Mode
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('list')}
                className={`flex-1 px-3 py-2 rounded-lg font-medium transition-colors ${
                  viewMode === 'list' ? 'bg-cyan-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <i className="fas fa-list mr-1"></i>List
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={`flex-1 px-3 py-2 rounded-lg font-medium transition-colors ${
                  viewMode === 'kanban' ? 'bg-cyan-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <i className="fas fa-columns mr-1"></i>Board
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`flex-1 px-3 py-2 rounded-lg font-medium transition-colors ${
                  viewMode === 'calendar' ? 'bg-cyan-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <i className="fas fa-calendar mr-1"></i>Cal
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <i className="fas fa-filter mr-2"></i>Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in-progress">In Progress</option>
              <option value="snoozed">Snoozed</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <i className="fas fa-flag mr-2"></i>Priority
            </label>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value as any)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="all">All Priorities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <i className="fas fa-sort mr-2"></i>Quick Actions
            </label>
            <button className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium">
              <i className="fas fa-file-export mr-2"></i>Export Tasks
            </button>
          </div>
        </div>
      </div>

      {/* List View */}
      {viewMode === 'list' && !loading && !error && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800">Task List ({filteredTasks.length})</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {filteredTasks.length === 0 ? (
              <div className="p-12 text-center">
                <i className="fas fa-inbox text-6xl text-gray-300 mb-4"></i>
                <p className="text-xl font-semibold text-gray-800 mb-2">No Tasks Found</p>
                <p className="text-gray-500">Create a new task to get started</p>
              </div>
            ) : (
              filteredTasks.map((task) => (
                <div
                  key={task.id}
                  className={`p-6 hover:bg-gray-50 transition-colors border-l-4 ${getPriorityColor(task.priority)}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">{getTypeIcon(task.type)}</span>
                        <h4 className="font-bold text-gray-800 text-lg">{task.title}</h4>
                        {getPriorityBadge(task.priority)}
                        {getStatusBadge(task.status)}
                        {task.autoCloseEnabled && (
                          <span className="px-2 py-1 bg-cyan-100 text-cyan-700 rounded text-xs font-semibold">
                            <i className="fas fa-magic mr-1"></i>Auto-close
                          </span>
                        )}
                      </div>

                      <p className="text-gray-600 mb-3">{task.description}</p>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 text-sm">
                        <div>
                          <span className="text-gray-600">Due Date:</span>
                          <span className={`ml-2 font-semibold ${isOverdue(task.dueDate) && task.status !== 'completed' ? 'text-red-600' : 'text-gray-800'}`}>
                            {task.dueDate.toLocaleDateString()}
                            {isOverdue(task.dueDate) && task.status !== 'completed' && (
                              <i className="fas fa-exclamation-triangle ml-1 text-red-500"></i>
                            )}
                          </span>
                        </div>
                        {task.linkedParameter && (
                          <div>
                            <span className="text-gray-600">Parameter:</span>
                            <span className="ml-2 font-semibold text-gray-800">{task.linkedParameter}</span>
                          </div>
                        )}
                        {task.assignedTo && (
                          <div>
                            <span className="text-gray-600">Assigned:</span>
                            <span className="ml-2 font-semibold text-gray-800">{task.assignedTo}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-600">Type:</span>
                          <span className="ml-2 font-semibold text-gray-800 capitalize">{task.type}</span>
                        </div>
                      </div>

                      {task.notes.length > 0 && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                          <p className="text-xs font-semibold text-blue-800 mb-1">
                            <i className="fas fa-sticky-note mr-1"></i>Notes ({task.notes.length}):
                          </p>
                          <div className="space-y-1 max-h-20 overflow-y-auto">
                            {task.notes.slice(-2).map((note, idx) => (
                              <p key={idx} className="text-xs text-blue-700">• {note}</p>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        {task.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleStatusChange(task.id, 'in-progress')}
                              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
                            >
                              <i className="fas fa-play mr-2"></i>Start
                            </button>
                            <button
                              onClick={() => handleSnooze(task.id, 24)}
                              className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors text-sm font-medium"
                            >
                              <i className="fas fa-clock mr-2"></i>Snooze 24h
                            </button>
                          </>
                        )}
                        {task.status === 'in-progress' && (
                          <button
                            onClick={() => handleStatusChange(task.id, 'completed')}
                            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
                          >
                            <i className="fas fa-check mr-2"></i>Complete
                          </button>
                        )}
                        {task.status === 'snoozed' && task.snoozeUntil && (
                          <span className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium">
                            <i className="fas fa-moon mr-2"></i>Until {task.snoozeUntil.toLocaleString()}
                          </span>
                        )}
                        <button
                          onClick={() => {
                            setSelectedTask(task);
                            setShowTaskDetail(true);
                          }}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
                        >
                          <i className="fas fa-info-circle mr-2"></i>Details
                        </button>
                        <button
                          onClick={() => {
                            const note = prompt('Add a note:');
                            if (note) handleAddNote(task.id, note);
                          }}
                          className="px-4 py-2 bg-cyan-100 text-cyan-700 rounded-lg hover:bg-cyan-200 transition-colors text-sm font-medium"
                        >
                          <i className="fas fa-comment mr-2"></i>Add Note
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Kanban View */}
      {viewMode === 'kanban' && !loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {kanbanColumns.map((column) => (
            <div key={column.status} className={`${column.color} rounded-xl p-4 border border-gray-200`}>
              <h3 className="font-bold text-gray-800 mb-4 flex items-center justify-between">
                <span>{column.title}</span>
                <span className="bg-white px-2 py-1 rounded-full text-sm">
                  {tasks.filter(t => t.status === column.status).length}
                </span>
              </h3>
              <div className="space-y-3">
                {tasks
                  .filter(t => t.status === column.status)
                  .map((task) => (
                    <div
                      key={task.id}
                      className={`bg-white rounded-lg p-4 shadow-sm border-l-4 ${getPriorityColor(task.priority)} hover:shadow-md transition-shadow cursor-pointer`}
                      onClick={() => {
                        setSelectedTask(task);
                        setShowTaskDetail(true);
                      }}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-2xl">{getTypeIcon(task.type)}</span>
                        {getPriorityBadge(task.priority)}
                      </div>
                      <h4 className="font-semibold text-gray-800 mb-2">{task.title}</h4>
                      <p className="text-xs text-gray-600 mb-2 line-clamp-2">{task.description}</p>
                      <div className="text-xs text-gray-600">
                        <i className="fas fa-calendar mr-1"></i>
                        {task.dueDate.toLocaleDateString()}
                      </div>
                      {task.linkedParameter && (
                        <div className="text-xs text-cyan-600 mt-1">
                          <i className="fas fa-link mr-1"></i>
                          {task.linkedParameter}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Calendar View */}
      {viewMode === 'calendar' && !loading && !error && (
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              <i className="fas fa-chevron-left"></i>
            </button>
            <h3 className="text-xl font-bold text-gray-800">
              {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h3>
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              <i className="fas fa-chevron-right"></i>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="text-center font-semibold text-gray-700 py-2">
                {day}
              </div>
            ))}
            {getDaysInMonth(currentMonth).map((day, idx) => {
              if (!day) {
                return <div key={`empty-${idx}`} className="aspect-square"></div>;
              }
              const dayTasks = getTasksForDate(day);
              const _hasHighPriority = dayTasks.some(t => t.priority === 'high');
              return (
                <div
                  key={day.toISOString()}
                  className={`aspect-square border rounded-lg p-2 ${
                    isToday(day) ? 'bg-cyan-100 border-cyan-500' : 'bg-gray-50 border-gray-200'
                  } hover:bg-gray-100 transition-colors cursor-pointer`}
                >
                  <div className="flex flex-col h-full">
                    <span className={`text-sm font-semibold ${isToday(day) ? 'text-cyan-700' : 'text-gray-700'}`}>
                      {day.getDate()}
                    </span>
                    {dayTasks.length > 0 && (
                      <div className="mt-1 space-y-1">
                        {dayTasks.slice(0, 2).map((task) => (
                          <div
                            key={task.id}
                            className={`text-xs p-1 rounded ${
                              task.priority === 'high'
                                ? 'bg-red-100 text-red-700'
                                : task.priority === 'medium'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                            title={task.title}
                          >
                            <div className="truncate">{task.title}</div>
                          </div>
                        ))}
                        {dayTasks.length > 2 && (
                          <div className="text-xs text-gray-600 text-center">+{dayTasks.length - 2} more</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-800">Create New Task</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Task Title</label>
                  <input
                    type="text"
                    placeholder="e.g., pH Sensor Calibration"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                  <textarea
                    rows={3}
                    placeholder="Detailed description of the task..."
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  ></textarea>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Priority</label>
                    <select 
                      value={formData.priority}
                      onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as any }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Type</label>
                    <select 
                      value={formData.type}
                      onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    >
                      <option value="calibration">Calibration</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="cleaning">Cleaning</option>
                      <option value="inspection">Inspection</option>
                      <option value="treatment">Treatment</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Due Date</label>
                    <input
                      type="datetime-local"
                      value={formData.dueDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Linked Parameter</label>
                    <select 
                      value={formData.linkedParameter}
                      onChange={(e) => setFormData(prev => ({ ...prev, linkedParameter: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    >
                      <option value="">None</option>
                      <option value="pH Level">pH Level</option>
                      <option value="Turbidity">Turbidity</option>
                      <option value="Temperature">Temperature</option>
                      <option value="Dissolved Oxygen">Dissolved Oxygen</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Assigned To (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g., John Doe"
                    value={formData.assignedTo}
                    onChange={(e) => setFormData(prev => ({ ...prev, assignedTo: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      checked={formData.autoCloseEnabled}
                      onChange={(e) => setFormData(prev => ({ ...prev, autoCloseEnabled: e.target.checked }))}
                      className="w-4 h-4 text-cyan-500" 
                    />
                    <span className="text-sm font-semibold text-gray-700">
                      Enable auto-close when parameter returns to normal
                    </span>
                  </label>
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={handleCreateTask}
                    className="flex-1 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors font-medium"
                  >
                    Create Task
                  </button>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Task Detail Modal */}
      {showTaskDetail && selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{getTypeIcon(selectedTask.type)}</span>
                  <h3 className="text-xl font-bold text-gray-800">{selectedTask.title}</h3>
                </div>
                <button
                  onClick={() => setShowTaskDetail(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                {getPriorityBadge(selectedTask.priority)}
                {getStatusBadge(selectedTask.status)}
                {selectedTask.autoCloseEnabled && (
                  <span className="px-2 py-1 bg-cyan-100 text-cyan-700 rounded text-xs font-semibold">
                    <i className="fas fa-magic mr-1"></i>Auto-close enabled
                  </span>
                )}
              </div>
              <div>
                <h4 className="font-semibold text-gray-800 mb-2">Description</h4>
                <p className="text-gray-600">{selectedTask.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-gray-800 mb-1">Due Date</h4>
                  <p className="text-gray-600">{selectedTask.dueDate.toLocaleString()}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800 mb-1">Created</h4>
                  <p className="text-gray-600">{selectedTask.createdDate.toLocaleString()}</p>
                </div>
                {selectedTask.linkedParameter && (
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-1">Linked Parameter</h4>
                    <p className="text-gray-600">{selectedTask.linkedParameter}</p>
                  </div>
                )}
                {selectedTask.assignedTo && (
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-1">Assigned To</h4>
                    <p className="text-gray-600">{selectedTask.assignedTo}</p>
                  </div>
                )}
              </div>
              {selectedTask.notes.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-800 mb-2">Notes</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {selectedTask.notes.map((note, idx) => (
                      <div key={idx} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-sm text-blue-700">{note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-3 pt-4 border-t">
                {selectedTask.status === 'pending' && (
                  <>
                    <button
                      onClick={() => {
                        handleStatusChange(selectedTask.id, 'in-progress');
                        setShowTaskDetail(false);
                      }}
                      className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
                    >
                      <i className="fas fa-play mr-2"></i>Start Task
                    </button>
                    <button
                      onClick={() => {
                        handleSnooze(selectedTask.id, 24);
                        setShowTaskDetail(false);
                      }}
                      className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors font-medium"
                    >
                      <i className="fas fa-clock mr-2"></i>Snooze
                    </button>
                  </>
                )}
                {selectedTask.status === 'in-progress' && (
                  <button
                    onClick={() => {
                      handleStatusChange(selectedTask.id, 'completed');
                      setShowTaskDetail(false);
                    }}
                    className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
                  >
                    <i className="fas fa-check mr-2"></i>Mark Complete
                  </button>
                )}
                <button
                  onClick={() => handleDeleteTask(selectedTask.id)}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
                >
                  <i className="fas fa-trash mr-2"></i>Delete
                </button>
                <button
                  onClick={() => setShowTaskDetail(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskCalendar;
