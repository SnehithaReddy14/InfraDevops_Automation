import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  Folder,
  ChevronRight,
  User,
  Server,
  X,
  Wrench,
  Building2,
  FileText,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../utils/api';
import { TOOLS_LIST, slugifyProjectName } from '../constants/tools';

interface Project {
  id: number;
  name: string;
  code: string;
  description: string | null;
  owner: string;
  businessUnit: string | null;
  status: string;
  costCenter: string | null;
  tags: string | null;
  billingProvider: string;
  awsAccount: string | null;
  resourceCount?: number;
  monthlyCost?: number;
}

const emptyForm = {
  name: '',
  description: '',
  owner: '',
  businessUnit: '',
  status: 'ACTIVE',
  costCenter: '',
  billingProvider: 'AWS',
};

export const Projects: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [toolFilter, setToolFilter] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await api.get('/projects');
      setProjects(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleOpenCreateModal = () => {
    setEditingProject(null);
    setFormData(emptyForm);
    setSubmitError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProject(project);
    setFormData({
      name: project.name || '',
      description: project.description || '',
      owner: project.owner || '',
      businessUnit: project.businessUnit || '',
      status: project.status || 'ACTIVE',
      costCenter: project.costCenter || '',
      billingProvider: project.billingProvider || 'AWS',
    });
    setIsModalOpen(true);
  };

  const handleDeleteProject = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Delete this project and all its resources and invoices?')) return;
    try {
      await api.delete(`/projects/${id}`);
      fetchProjects();
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);

    const submitData = {
      name: formData.name.trim(),
      code: slugifyProjectName(formData.name) || slugifyProjectName(`project-${Date.now()}`),
      description: formData.description.trim(),
      owner: formData.owner.trim(),
      businessUnit: formData.businessUnit.trim(),
      status: formData.status,
      costCenter: formData.costCenter.trim(),
      billingProvider: formData.billingProvider,
    };

    try {
      if (editingProject) {
        await api.put(`/projects/${editingProject.id}`, submitData);
        setIsModalOpen(false);
        await fetchProjects();
      } else {
        const created = await api.post('/projects', submitData);
        setIsModalOpen(false);
        await fetchProjects();
        if (created?.id) {
          navigate(`/projects/${created.id}`);
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save workspace';
      setSubmitError(message);
      console.error('Failed to save project:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProjects = projects.filter((p) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      p.name.toLowerCase().includes(q) ||
      p.owner.toLowerCase().includes(q) ||
      (p.businessUnit || '').toLowerCase().includes(q);
    const matchesTool = toolFilter ? p.billingProvider === toolFilter : true;
    return matchesSearch && matchesTool;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 select-none">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-800 flex items-center gap-2">
            <Folder className="text-blue-600" size={24} />
            <span>InfraOps Projects</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            One workspace per project — add infrastructure resources and upload invoices per environment after creation.
          </p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors shadow-sm"
        >
          <Plus size={16} />
          <span>New Workspace</span>
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-3 bg-white border border-slate-200/80 rounded-2xl p-4 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05)]">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-3 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search by project name, owner, or business unit..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 text-xs transition-colors"
          />
        </div>
        <select
          value={toolFilter}
          onChange={(e) => setToolFilter(e.target.value)}
          className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-600 bg-white"
        >
          <option value="">All Tools</option>
          {TOOLS_LIST.map((tool) => (
            <option key={tool} value={tool}>
              {tool}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-500">Loading workspaces...</span>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl">
          <Folder className="mx-auto text-slate-300 mb-2" size={40} />
          <h3 className="font-semibold text-slate-700 text-sm">No workspaces yet</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Create a project workspace, then add infra resources and upload invoices for each environment inside it.
          </p>
          <button
            onClick={handleOpenCreateModal}
            className="mt-4 px-3.5 py-2 rounded-xl border border-slate-200 hover:border-slate-300 text-xs font-semibold text-slate-600 transition-colors"
          >
            Create first workspace
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <motion.div
              key={project.id}
              onClick={() => navigate(`/projects/${project.id}`)}
              whileHover={{ y: -4, boxShadow: '0 12px 30px -10px rgba(0, 0, 0, 0.05)' }}
              className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05)] cursor-pointer flex flex-col justify-between h-full group relative"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 tracking-wider inline-flex items-center gap-1">
                      <Wrench size={10} />
                      {project.billingProvider}
                    </span>
                    <h3 className="font-bold text-slate-800 text-sm group-hover:text-blue-600 transition-colors mt-2">
                      {project.name}
                    </h3>
                    {project.businessUnit && (
                      <p className="text-[11px] text-slate-400 mt-0.5">{project.businessUnit}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleOpenEditModal(project, e)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                      title="Edit workspace"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={(e) => handleDeleteProject(project.id, e)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                      title="Delete workspace"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-500 line-clamp-2 h-8">
                  {project.description || 'No description provided.'}
                </p>

                <div className="grid grid-cols-2 gap-y-2 pt-2 text-[11px]">
                  <div className="flex items-center gap-1.5 text-slate-450">
                    <User size={12} />
                    <span>
                      Owner: <strong>{project.owner}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-450">
                    <Server size={12} />
                    <span>
                      Resources: <strong>{project.resourceCount || 0}</strong>
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 group-hover:text-blue-600 transition-colors">
                  Open workspace
                </span>
                <ChevronRight
                  className="text-slate-400 group-hover:text-blue-600 transform group-hover:translate-x-0.5 transition-all"
                  size={14}
                />
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl w-full max-w-lg shadow-xl border border-slate-200 overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/80">
                <div>
                  <h2 className="font-black text-slate-800 text-base">
                    {editingProject ? 'Edit Workspace' : 'New Workspace'}
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {editingProject
                      ? 'Update project details. Environment and region are set per resource.'
                      : 'Set up the project shell — add infra and invoices after launch.'}
                  </p>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5 text-xs">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-600 flex items-center gap-1.5">
                    <Folder size={13} className="text-blue-500" />
                    Project Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ATG Core Platform"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-600 flex items-center gap-1.5">
                    <FileText size={13} className="text-slate-400" />
                    Description
                  </label>
                  <textarea
                    placeholder="What does this project cover? (optional)"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-600">Owner *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Snehitha G"
                      value={formData.owner}
                      onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-600 flex items-center gap-1.5">
                      <Building2 size={13} className="text-slate-400" />
                      Business Unit
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Cloud Infra"
                      value={formData.businessUnit}
                      onChange={(e) => setFormData({ ...formData, businessUnit: e.target.value })}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-600 flex items-center gap-1.5">
                      <Wrench size={13} className="text-blue-500" />
                      Tool *
                    </label>
                    <select
                      required
                      value={formData.billingProvider}
                      onChange={(e) => setFormData({ ...formData, billingProvider: e.target.value })}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-blue-500"
                    >
                      {TOOLS_LIST.map((tool) => (
                        <option key={tool} value={tool}>
                          {tool}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400">
                      Primary billing tool for this project. Resources can use a different tool if needed.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-600">Cost Center</label>
                    <input
                      type="text"
                      placeholder="e.g. CC-9908"
                      value={formData.costCenter}
                      onChange={(e) => setFormData({ ...formData, costCenter: e.target.value })}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {editingProject && (
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-600">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-white"
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="SUSPENDED">Suspended</option>
                      <option value="DECOMMISSIONED">Decommissioned</option>
                    </select>
                  </div>
                )}

                {!editingProject && (
                  <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-[11px] text-blue-700 leading-relaxed">
                    After creating this workspace, open it to add infrastructure resources (with environment &amp; region per
                    resource) and upload invoices for each environment.
                  </div>
                )}

                {submitError && (
                  <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-[11px] text-red-700">
                    {submitError}
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    disabled={submitting}
                    className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 font-semibold text-slate-600 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors disabled:opacity-60"
                  >
                    {submitting ? 'Creating…' : editingProject ? 'Save Changes' : 'Create Workspace'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Projects;
