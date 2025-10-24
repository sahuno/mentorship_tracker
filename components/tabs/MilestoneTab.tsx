import React, { useState, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { User, Milestone, MilestoneStatus, MilestoneCategory, ProgressReport } from '../../types';
import MilestoneCard from '../MilestoneCard';
import AddMilestoneModal from '../AddMilestoneModal';
import ProgressReportModal from '../ProgressReportModal';

interface MilestoneTabProps {
  user: User;
  milestones: Milestone[];
  onMilestonesUpdate: (milestones: Milestone[]) => void;
}

const MilestoneTab: React.FC<MilestoneTabProps> = ({ user, milestones, onMilestonesUpdate }) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [reportingMilestone, setReportingMilestone] = useState<Milestone | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | MilestoneStatus>('all');
  const [filterCategory, setFilterCategory] = useState<'all' | MilestoneCategory>('all');

  // Calculate statistics
  const stats = useMemo(() => {
    const total = milestones.length;
    const active = milestones.filter(m => m.status === MilestoneStatus.IN_PROGRESS).length;
    const completed = milestones.filter(m => m.status === MilestoneStatus.COMPLETED).length;
    const notStarted = milestones.filter(m => m.status === MilestoneStatus.NOT_STARTED).length;

    return { total, active, completed, notStarted };
  }, [milestones]);

  // Filter milestones
  const filteredMilestones = useMemo(() => {
    let filtered = [...milestones];

    if (filterStatus !== 'all') {
      filtered = filtered.filter(m => m.status === filterStatus);
    }

    if (filterCategory !== 'all') {
      filtered = filtered.filter(m => m.category === filterCategory);
    }

    // Sort by status (in_progress first) then by created date
    filtered.sort((a, b) => {
      if (a.status === MilestoneStatus.IN_PROGRESS && b.status !== MilestoneStatus.IN_PROGRESS) return -1;
      if (a.status !== MilestoneStatus.IN_PROGRESS && b.status === MilestoneStatus.IN_PROGRESS) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return filtered;
  }, [milestones, filterStatus, filterCategory]);

  // Handlers
  const handleAddMilestone = () => {
    setEditingMilestone(null);
    setIsAddModalOpen(true);
  };

  const handleEditMilestone = (milestone: Milestone) => {
    setEditingMilestone(milestone);
    setIsAddModalOpen(true);
  };

  const handleDeleteMilestone = (milestoneId: string) => {
    if (window.confirm('Are you sure you want to delete this milestone? All progress reports will be lost.')) {
      const updatedMilestones = milestones.filter(m => m.id !== milestoneId);
      onMilestonesUpdate(updatedMilestones);
    }
  };

  const handleSaveMilestone = (milestoneData: Omit<Milestone, 'id' | 'userId' | 'createdAt' | 'progressReports'>) => {
    if (editingMilestone) {
      // Update existing milestone
      const updatedMilestones = milestones.map(m =>
        m.id === editingMilestone.id
          ? { ...m, ...milestoneData }
          : m
      );
      onMilestonesUpdate(updatedMilestones);
    } else {
      // Create new milestone
      const newMilestone: Milestone = {
        ...milestoneData,
        id: uuidv4(),
        userId: user.id,
        createdAt: new Date().toISOString(),
        progressReports: []
      };
      onMilestonesUpdate([...milestones, newMilestone]);
    }
    setIsAddModalOpen(false);
  };

  const handleAddReport = (milestone: Milestone) => {
    setReportingMilestone(milestone);
    setIsReportModalOpen(true);
  };

  const handleSaveReport = (report: Omit<ProgressReport, 'id'>) => {
    if (!reportingMilestone) return;

    const newReport: ProgressReport = {
      ...report,
      id: uuidv4()
    };

    const updatedMilestones = milestones.map(m =>
      m.id === reportingMilestone.id
        ? { ...m, progressReports: [...m.progressReports, newReport] }
        : m
    );

    onMilestonesUpdate(updatedMilestones);
    setIsReportModalOpen(false);
  };

  const handleUpdateStatus = (milestoneId: string, newStatus: MilestoneStatus) => {
    const updatedMilestones = milestones.map(m =>
      m.id === milestoneId
        ? { ...m, status: newStatus }
        : m
    );
    onMilestonesUpdate(updatedMilestones);
  };

  const getCategoryColor = (category: MilestoneCategory) => {
    switch (category) {
      case MilestoneCategory.EDUCATION: return 'bg-blue-100 text-blue-800';
      case MilestoneCategory.SKILL: return 'bg-purple-100 text-purple-800';
      case MilestoneCategory.PROJECT: return 'bg-green-100 text-green-800';
      case MilestoneCategory.FITNESS: return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Milestones</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="p-3 bg-indigo-100 rounded-full">
              <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active</p>
              <p className="text-2xl font-bold text-blue-600">{stats.active}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Not Started</p>
              <p className="text-2xl font-bold text-gray-600">{stats.notStarted}</p>
            </div>
            <div className="p-3 bg-gray-100 rounded-full">
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Add Button */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex flex-wrap gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'all' | MilestoneStatus)}
              className="px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">All Status</option>
              <option value={MilestoneStatus.NOT_STARTED}>Not Started</option>
              <option value={MilestoneStatus.IN_PROGRESS}>In Progress</option>
              <option value={MilestoneStatus.COMPLETED}>Completed</option>
              <option value={MilestoneStatus.PAUSED}>Paused</option>
            </select>

            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as 'all' | MilestoneCategory)}
              className="px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">All Categories</option>
              <option value={MilestoneCategory.EDUCATION}>Education</option>
              <option value={MilestoneCategory.SKILL}>Skill</option>
              <option value={MilestoneCategory.PROJECT}>Project</option>
              <option value={MilestoneCategory.FITNESS}>Fitness</option>
              <option value={MilestoneCategory.OTHER}>Other</option>
            </select>
          </div>

          <button
            onClick={handleAddMilestone}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Milestone
          </button>
        </div>
      </div>

      {/* Milestones Grid */}
      {filteredMilestones.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMilestones.map(milestone => (
            <MilestoneCard
              key={milestone.id}
              milestone={milestone}
              onEdit={handleEditMilestone}
              onDelete={handleDeleteMilestone}
              onAddReport={handleAddReport}
              onUpdateStatus={handleUpdateStatus}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No milestones found</h3>
          <p className="text-gray-600">
            {filterStatus !== 'all' || filterCategory !== 'all'
              ? 'Try adjusting your filters or add a new milestone'
              : 'Get started by adding your first milestone'}
          </p>
          <button
            onClick={handleAddMilestone}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Add Your First Milestone
          </button>
        </div>
      )}

      {/* Modals */}
      {isAddModalOpen && (
        <AddMilestoneModal
          onClose={() => setIsAddModalOpen(false)}
          onSave={handleSaveMilestone}
          milestoneToEdit={editingMilestone}
        />
      )}

      {isReportModalOpen && reportingMilestone && (
        <ProgressReportModal
          milestone={reportingMilestone}
          onClose={() => setIsReportModalOpen(false)}
          onSave={handleSaveReport}
        />
      )}
    </div>
  );
};

export default MilestoneTab;