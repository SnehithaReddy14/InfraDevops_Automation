import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Folder, 
  Activity, 
  Plus, 
  Trash2, 
  UploadCloud, 
  AlertCircle, 
  Download, 
  Edit3, 
  X,
  Globe,
  RefreshCw,
  User,
  Eye,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api, { getServerBaseUrl } from '../utils/api';
import { TOOLS_LIST, ENVIRONMENTS, REGIONS } from '../constants/tools';
import {
  getResourceTypesForTool,
  getDefaultResourceTypeForTool,
  getDefaultInstanceTypeForTool,
  canLookupResourcePricing,
  getResourceFormProfile,
  applyProfileToFormFields,
} from '../constants/resourceTypes';
import { DynamicBillingView } from '../components/DynamicBillingView';
import type { BillingView } from '../components/DynamicBillingView';
import {
  BillingDiscrepancyPanel,
  type BillingDiscrepancyReport,
} from '../components/BillingDiscrepancyPanel';
import { navigateWithReturn, projectInvoiceBreadcrumbs } from '../utils/navigation';
import { MonthPeriodFilter, type MonthPeriodValue } from '../components/MonthPeriodFilter';
import { EnvironmentFilter } from '../components/EnvironmentFilter';
import { isWithinMonthRange } from '../utils/monthPeriod';
import {
  usesInvoiceEnvironmentSplit,
  hasTaggedInvoiceEnvironments,
  formatInvoiceEnvironment,
} from '../utils/environmentUtils';
import {
  formatBillingSeats,
  parseSeatFromText,
  type BillingUnit,
} from '../utils/saasUtils';

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
}

interface CloudResource {
  id: number;
  instanceName: string;
  resourceType: string;
  instanceType: string | null;
  vcpus: number;
  memory: number;
  storage: number;
  publicIp: string | null;
  monthlyCost: number;
  billingSeats?: number | null;
  billingUnit?: string | null;
  status: string;
  environment: string;
  region: string;
  tool: string;
}

interface Invoice {
  id: number;
  invoiceNumber: string;
  invoiceDate: string | null;
  grandTotal: number;
  currency: string;
  billingMonth: string | null;
  environment?: string | null;
  status: string;
  originalFilePath: string | null;
}

interface ResourceFormState {
  instanceName: string;
  resourceType: string;
  instanceType: string;
  vcpus: string;
  memory: string;
  storage: string;
  publicIp: string;
  monthlyCost: string;
  billingSeats: string;
  billingUnit: BillingUnit;
  status: string;
  environment: string;
  region: string;
  tool: string;
}

/** Default vCPU/RAM for common AWS instance types (auto-filled when spec type changes). */
const AWS_INSTANCE_SPECS: Record<string, { vcpus: number; memory: number }> = {
  't2.micro': { vcpus: 1, memory: 1 },
  't3.micro': { vcpus: 2, memory: 1 },
  't3.small': { vcpus: 2, memory: 2 },
  't3.medium': { vcpus: 2, memory: 4 },
  't3.large': { vcpus: 2, memory: 8 },
  't3.xlarge': { vcpus: 4, memory: 16 },
  'm5.large': { vcpus: 2, memory: 8 },
  'm5.xlarge': { vcpus: 4, memory: 16 },
  'db.t3.micro': { vcpus: 2, memory: 1 },
  'db.t3.small': { vcpus: 2, memory: 2 },
  'db.t3.medium': { vcpus: 2, memory: 4 },
};

function parseResourceForm(form: ResourceFormState, profile = getResourceFormProfile(form.tool, form.resourceType)) {
  const seatParsed = parseSeatFromText(`${form.billingSeats} ${form.billingUnit}`);
  const billingSeats = profile.showBillingSeats
    ? parseInt(form.billingSeats, 10) || seatParsed?.seatCount || 0
    : 0;

  return {
    ...form,
    instanceType: profile.showInstanceSpec ? form.instanceType : '',
    vcpus: profile.showVcpus ? (parseInt(form.vcpus, 10) || 1) : 0,
    memory: profile.showMemory ? (parseFloat(form.memory) || 0) : 0,
    storage: profile.showStorage ? (parseFloat(form.storage) || 0) : 0,
    monthlyCost: parseFloat(form.monthlyCost) || 0,
    publicIp: profile.showIp ? form.publicIp : '',
    billingSeats: profile.showBillingSeats ? billingSeats : null,
    billingUnit: profile.showBillingSeats ? form.billingUnit : null,
  };
}

export const ProjectWorkspace: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const apiBaseUrl = getServerBaseUrl();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'infrastructure' | 'invoices' | 'billing'>('overview');

  // Lists state
  const [resources, setResources] = useState<CloudResource[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [billingView, setBillingView] = useState<BillingView | null>(null);
  const [billingViewLoading, setBillingViewLoading] = useState(false);
  const [discrepancyReport, setDiscrepancyReport] = useState<BillingDiscrepancyReport | null>(null);
  const [discrepancyLoading, setDiscrepancyLoading] = useState(false);
  const [invoicePeriod, setInvoicePeriod] = useState<MonthPeriodValue>({ fromMonth: null, toMonth: null });
  const [uploadEnvironment, setUploadEnvironment] = useState('');
  const [tagUploadEnv, setTagUploadEnv] = useState(false);
  const [billingEnvironment, setBillingEnvironment] = useState<string | null>(null);

  // Modals / Actions states
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
  const MAX_FILE_SIZE = 10 * 1024 * 1024;

  const validateInvoiceFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `${file.name}: unsupported type (use PDF, PNG, or JPEG)`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `${file.name}: exceeds 10MB limit`;
    }
    return null;
  };

  const uploadInvoiceFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    const errors: string[] = [];
    const validFiles = files.filter((file) => {
      const err = validateInvoiceFile(file);
      if (err) errors.push(err);
      return !err;
    });

    if (validFiles.length === 0) {
      alert(errors.join('\n') || 'No valid files selected.');
      return;
    }

    setUploading(true);
    let successCount = 0;

    try {
      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        setUploadProgress(`Processing ${i + 1}/${validFiles.length}: ${file.name}`);
        const formData = new FormData();
        formData.append('invoice', file);
        formData.append('projectId', id || '');
        if (uploadEnvironment.trim()) {
          formData.append('environment', uploadEnvironment.trim());
        }
        await api.post('/invoices/upload', formData, true);
        successCount++;
      }

      const summary =
        successCount === validFiles.length
          ? `${successCount} invoice${successCount !== 1 ? 's' : ''} uploaded successfully.`
          : `${successCount} uploaded, ${validFiles.length - successCount} failed.`;
      if (errors.length) {
        alert(`${summary}\n\nSkipped:\n${errors.join('\n')}`);
      } else if (validFiles.length > 1) {
        setUploadProgress(summary);
      }

      await fetchProjectData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      alert(
        successCount > 0
          ? `${successCount} uploaded before error.\n${message}`
          : `Upload failed: ${message}`
      );
      if (successCount > 0) await fetchProjectData();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setUploadProgress(null), validFiles.length > 1 ? 3000 : 0);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    await uploadInvoiceFiles(e.target.files);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (uploading || !e.dataTransfer.files?.length) return;
    await uploadInvoiceFiles(e.dataTransfer.files);
  };
  const [isResourceModalOpen, setIsResourceModalOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<CloudResource | null>(null);
  const [resourceForm, setResourceForm] = useState<ResourceFormState>({
    instanceName: '',
    resourceType: getDefaultResourceTypeForTool('AWS'),
    instanceType: 't3.micro',
    vcpus: '2',
    memory: '1',
    storage: '30',
    publicIp: '',
    monthlyCost: '',
    billingSeats: '',
    billingUnit: 'users',
    status: 'RUNNING',
    environment: 'Production',
    region: 'us-east-1',
    tool: 'AWS',
  });

  const defaultResourceForm = (tool = 'AWS'): ResourceFormState => {
    const resourceType = getDefaultResourceTypeForTool(tool);
    return {
      instanceName: '',
      resourceType,
      instanceType: getDefaultInstanceTypeForTool(tool, resourceType),
      vcpus: '2',
      memory: '1',
      storage: '30',
      publicIp: '',
      monthlyCost: '',
      billingSeats: '',
      billingUnit: tool === 'Jira' ? 'users' : 'users',
      status: 'RUNNING',
      environment: 'Production',
      region: 'us-east-1',
      tool,
    };
  };

  const [isProjectEditOpen, setIsProjectEditOpen] = useState(false);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingNote, setPricingNote] = useState<string | null>(null);
  const [costManuallyEdited, setCostManuallyEdited] = useState(false);
  const [specsManuallyEdited, setSpecsManuallyEdited] = useState(false);

  const resourceProfile = getResourceFormProfile(resourceForm.tool, resourceForm.resourceType);

  const lookupPricing = async (force = false) => {
    if (!force && costManuallyEdited) return;
    if (!canLookupResourcePricing(resourceProfile, resourceForm)) return;

    const parsed = parseResourceForm(resourceForm, resourceProfile);
      const specForLookup =
        resourceForm.instanceType?.trim() ||
        (!resourceProfile.showInstanceSpec ? resourceForm.resourceType : '') ||
        getDefaultInstanceTypeForTool(resourceForm.tool, resourceForm.resourceType);

    setPricingLoading(true);
    try {
      const params = new URLSearchParams({
        tool: resourceForm.tool,
        resourceType: resourceForm.resourceType,
        region: resourceForm.region,
        vcpus: String(parsed.vcpus),
        memory: String(parsed.memory),
        storage: String(parsed.storage),
      });
      if (resourceForm.instanceName?.trim()) {
        params.set('instanceName', resourceForm.instanceName.trim());
      }
      if (resourceProfile.showBillingSeats && resourceForm.billingSeats.trim()) {
        params.set(
          'instanceType',
          `${resourceForm.billingSeats.trim()} ${resourceForm.billingUnit}${resourceForm.instanceType?.trim() ? ` — ${resourceForm.instanceType.trim()}` : ''}`
        );
      } else if (specForLookup) {
        params.set('instanceType', specForLookup);
      }

      const res = await api.get(`/pricing/estimate?${params.toString()}`);
      if (!costManuallyEdited || force) {
        setResourceForm((prev) => ({ ...prev, monthlyCost: String(res.monthlyCostUsd) }));
        setCostManuallyEdited(false);
      }
      setPricingNote(res.note);
    } catch {
      setPricingNote('Could not auto-fetch price. Set GEMINI_API_KEY on the backend or enter cost manually.');
    } finally {
      setPricingLoading(false);
    }
  };

  const applyInstanceSpecDefaults = (instanceType: string) => {
    if (!resourceProfile.showVcpus && !resourceProfile.showMemory) return;
    const spec = AWS_INSTANCE_SPECS[instanceType.trim().toLowerCase()];
    if (!spec || specsManuallyEdited) return;
    setResourceForm((prev) => ({
      ...prev,
      vcpus: String(spec.vcpus),
      memory: String(spec.memory),
    }));
  };

  const handleResourceTypeChange = (resourceType: string) => {
    setSpecsManuallyEdited(false);
    setCostManuallyEdited(false);
    setPricingNote(null);
    setResourceForm((prev) =>
      applyProfileToFormFields(
        {
          ...prev,
          resourceType,
          instanceType: getDefaultInstanceTypeForTool(prev.tool, resourceType),
        },
        prev.tool,
        resourceType
      )
    );
  };

  const handleToolChange = (tool: string) => {
    const resourceType = getDefaultResourceTypeForTool(tool);
    setSpecsManuallyEdited(false);
    setCostManuallyEdited(false);
    setPricingNote(null);
    setResourceForm((prev) =>
      applyProfileToFormFields(
        {
          ...prev,
          tool,
          resourceType,
          instanceType: getDefaultInstanceTypeForTool(tool, resourceType),
        },
        tool,
        resourceType
      )
    );
  };

  useEffect(() => {
    if (!isResourceModalOpen || editingResource) return;
    applyInstanceSpecDefaults(resourceForm.instanceType);
    const timer = setTimeout(() => {
      lookupPricing();
    }, 700);
    return () => clearTimeout(timer);
  }, [
    isResourceModalOpen,
    editingResource,
    resourceForm.instanceType,
    resourceForm.instanceName,
    resourceForm.resourceType,
    resourceForm.region,
    resourceForm.tool,
    resourceForm.vcpus,
    resourceForm.memory,
    resourceForm.storage,
  ]);

  const [projectForm, setProjectForm] = useState({
    name: '',
    description: '',
    owner: '',
    businessUnit: '',
    status: 'ACTIVE',
    costCenter: '',
    billingProvider: 'AWS',
  });

  const fetchBillingView = async (environment: string | null = billingEnvironment) => {
    if (!id) return;
    setBillingViewLoading(true);
    try {
      const envQuery = environment ? `?environment=${encodeURIComponent(environment)}` : '';
      const res = await api.get(`/projects/${id}/billing-view${envQuery}`);
      setBillingView(res);
    } catch (err) {
      console.error('Error fetching billing view:', err);
      setBillingView(null);
    } finally {
      setBillingViewLoading(false);
    }
  };

  const fetchDiscrepancies = async (environment: string | null = billingEnvironment) => {
    if (!id) return;
    setDiscrepancyLoading(true);
    try {
      const envQuery = environment ? `?environment=${encodeURIComponent(environment)}` : '';
      const res = await api.get(`/projects/${id}/billing-discrepancies${envQuery}`);
      setDiscrepancyReport(res);
    } catch (err) {
      console.error('Error fetching billing discrepancies:', err);
      setDiscrepancyReport(null);
    } finally {
      setDiscrepancyLoading(false);
    }
  };

  const fetchProjectData = async () => {
    setLoading(true);
    try {
      const pRes = await api.get(`/projects/${id}`);
      setProject(pRes);

      const rRes = await api.get(`/projects/${id}/resources`);
      setResources(Array.isArray(rRes) ? rRes : []);

      const iRes = await api.get(`/invoices?projectId=${id}&limit=100`);
      setInvoices(iRes?.invoices || []);

      await fetchBillingView();
      await fetchDiscrepancies();
    } catch (err) {
      console.error('Error fetching project workspace details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectData();
  }, [id]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'overview' || tab === 'infrastructure' || tab === 'invoices' || tab === 'billing') {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!id || activeTab !== 'billing') return;
    fetchBillingView(billingEnvironment);
    fetchDiscrepancies(billingEnvironment);
  }, [billingEnvironment, id, activeTab]);

  const showEnvFilter = useMemo(() => usesInvoiceEnvironmentSplit(invoices), [invoices]);
  const showEnvColumn = useMemo(() => hasTaggedInvoiceEnvironments(invoices), [invoices]);
  const showUploadEnvPicker = tagUploadEnv || showEnvColumn || showEnvFilter;

  useEffect(() => {
    if (!showEnvFilter && billingEnvironment) {
      setBillingEnvironment(null);
    }
  }, [showEnvFilter, billingEnvironment]);

  const handleResourceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = parseResourceForm(resourceForm, resourceProfile);
    if (!payload.instanceName.trim()) {
      alert('Resource name is required.');
      return;
    }
    if (resourceProfile.id !== 'usage' && payload.monthlyCost <= 0) {
      alert('Enter a monthly cost or click Auto lookup price.');
      return;
    }
    try {
      if (editingResource) {
        await api.put(`/projects/resources/${editingResource.id}`, payload);
      } else {
        await api.post(`/projects/${id}/resources`, payload);
      }
      setIsResourceModalOpen(false);
      fetchProjectData();
    } catch (err) {
      console.error('Failed to save resource:', err);
    }
  };

  const handleDeleteResource = async (resId: number) => {
    if (!window.confirm('Delete this virtual resource?')) return;
    try {
      await api.delete(`/projects/resources/${resId}`);
      fetchProjectData();
    } catch (err) {
      console.error('Failed to delete resource:', err);
    }
  };

  const handleDeleteInvoice = async (invId: number) => {
    if (!window.confirm('Delete this invoice permanently?')) return;
    try {
      await api.delete(`/invoices/${invId}`);
      await fetchProjectData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete invoice');
    }
  };

  const openProjectEdit = () => {
    if (!project) return;
    setProjectForm({
      name: project.name,
      description: project.description || '',
      owner: project.owner,
      businessUnit: project.businessUnit || '',
      status: project.status,
      costCenter: project.costCenter || '',
      billingProvider: project.billingProvider,
    });
    setIsProjectEditOpen(true);
  };

  const handleProjectUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    try {
      await api.put(`/projects/${project.id}`, projectForm);
      setIsProjectEditOpen(false);
      await fetchProjectData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update project');
    }
  };

  const handleDeleteProject = async () => {
    if (!project) return;
    if (!window.confirm('Delete this project and all its resources and invoices?')) return;
    try {
      await api.delete(`/projects/${project.id}`);
      navigate('/projects');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete project');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-xs text-slate-500 font-bold">Synchronizing project workspace...</span>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl">
        <AlertCircle className="mx-auto text-red-500 mb-2" size={40} />
        <h3 className="font-semibold text-slate-700 text-sm">Workspace Not Found</h3>
        <button onClick={() => navigate('/projects')} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold">
          Back to Projects
        </button>
      </div>
    );
  }

  const totalMonthlyResourceSpend = resources.reduce((sum, r) => sum + r.monthlyCost, 0);
  const showSaasInfraColumns = resources.some(
    (r) => (r.billingSeats ?? 0) > 0 || getResourceFormProfile(r.tool, r.resourceType).showBillingSeats
  );
  const showPlanSkuColumn = resources.some((r) => Boolean(r.instanceType?.trim()));
  const showRegionColumn = resources.some((r) => r.region && r.region !== 'global');

  const filteredInvoices = invoices.filter((inv) => {
    if (billingEnvironment && inv.environment?.trim() !== billingEnvironment) return false;
    return isWithinMonthRange(inv.billingMonth || inv.invoiceDate?.slice(0, 7), invoicePeriod.fromMonth, invoicePeriod.toMonth);
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 select-none text-xs">
      {/* Top Banner details */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Folder className="text-blue-600" size={20} />
            <h1 className="text-xl font-black text-slate-800">{project.name}</h1>
            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600">
              Tool: {project.billingProvider}
            </span>
          </div>
          <p className="text-slate-500 max-w-2xl">{project.description || 'No description provided.'}</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2 text-slate-400">
            <div className="flex items-center gap-1"><User size={14} /><span>Owner: <strong>{project.owner}</strong></span></div>
            {project.businessUnit && (
              <div className="flex items-center gap-1"><Globe size={14} /><span>BU: <strong>{project.businessUnit}</strong></span></div>
            )}
            <div className="flex items-center gap-1"><Activity size={14} /><span>Status: <strong>{project.status}</strong></span></div>
          </div>
        </div>

        {/* Stats card */}
        <div className="flex flex-col gap-3 md:self-center">
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={openProjectEdit}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold"
            >
              <Edit3 size={13} /> Edit
            </button>
            <button
              type="button"
              onClick={handleDeleteProject}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 font-semibold"
            >
              <Trash2 size={13} /> Delete
            </button>
          </div>
          <div className="flex gap-4">
          <div className="px-4 py-3 bg-slate-50 rounded-xl border border-slate-200/50 min-w-[120px] text-center">
            <p className="text-[10px] uppercase font-bold text-slate-450">Resources</p>
            <p className="text-lg font-black text-slate-850 mt-1">{resources.length}</p>
          </div>
          <div className="px-4 py-3 bg-slate-50 rounded-xl border border-slate-200/50 min-w-[120px] text-center">
            <p className="text-[10px] uppercase font-bold text-slate-450">Est. Spend</p>
            <p className="text-lg font-black text-green-600 mt-1">${totalMonthlyResourceSpend.toFixed(2)}</p>
          </div>
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="border-b border-slate-200 flex space-x-6 text-sm font-semibold text-slate-500">
        {(['overview', 'infrastructure', 'invoices', 'billing'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 capitalize transition-all border-b-2 ${
              activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent hover:text-slate-800'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div className="pt-2">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Column 1: Details */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
                <h3 className="font-black text-slate-800 text-sm border-b border-slate-100 pb-2">Workspace Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-slate-400 font-bold">Tool</p>
                    <p className="font-semibold text-slate-700 mt-0.5">{project.billingProvider}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-bold">Owner</p>
                    <p className="font-semibold text-slate-700 mt-0.5">{project.owner}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-bold">Business Unit</p>
                    <p className="font-semibold text-slate-700 mt-0.5">{project.businessUnit || '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-bold">Cost Center</p>
                    <p className="font-semibold text-slate-700 mt-0.5">{project.costCenter || '—'}</p>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 pt-1">
                  Environment and region are configured per infrastructure resource — not at the project level.
                </p>
              </div>

              {/* Resource Summary */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <h3 className="font-black text-slate-800 text-sm mb-3">Infrastructure Composition</h3>
                {resources.length === 0 ? (
                  <p className="text-slate-400">No infrastructure resources yet. Add them from the Infrastructure tab.</p>
                ) : (
                  <div className="space-y-2">
                    {resources.slice(0, 3).map(res => (
                      <div key={res.id} className="flex justify-between p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                        <span className="font-semibold text-slate-700">{res.instanceName} ({res.resourceType})</span>
                        <span className="font-bold text-slate-600">${res.monthlyCost.toFixed(2)}/mo</span>
                      </div>
                    ))}
                    {resources.length > 3 && (
                      <p className="text-center text-[10px] text-blue-600 font-bold cursor-pointer mt-2" onClick={() => setActiveTab('infrastructure')}>
                        View all {resources.length} resources
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Column 2: Activity logs */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              <h3 className="font-black text-slate-800 text-sm border-b border-slate-100 pb-2">Latest Workspace Logs</h3>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5"></div>
                  <div>
                    <p className="font-semibold text-slate-700">Project workspace initialized</p>
                    <p className="text-[10px] text-slate-400">Initial setup</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5"></div>
                  <div>
                    <p className="font-semibold text-slate-700">Database schema push</p>
                    <p className="text-[10px] text-slate-400">Sync complete</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Infrastructure Tab */}
        {activeTab === 'infrastructure' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-black text-slate-800 text-sm">Active Node Inventory</h3>
                <p className="text-slate-500 mt-0.5">Manage virtual compute instances, network components, and databases.</p>
              </div>
              <button
                onClick={() => {
                  setEditingResource(null);
                  setResourceForm(defaultResourceForm(project?.billingProvider || 'AWS'));
                  setPricingNote(null);
                  setCostManuallyEdited(false);
                  setSpecsManuallyEdited(false);
                  setIsResourceModalOpen(true);
                }}
                className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
              >
                <Plus size={14} />
                <span>Add Resource</span>
              </button>
            </div>

            {resources.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 border border-slate-100 rounded-xl">
                <p className="text-slate-400">No active infrastructure nodes added to this workspace.</p>
              </div>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-450 font-bold text-left bg-slate-50">
                    <th className="p-3">Resource Name</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Tool</th>
                    <th className="p-3">Env</th>
                    {showRegionColumn && <th className="p-3">Region</th>}
                    {showSaasInfraColumns ? (
                      <th className="p-3">Billed seats</th>
                    ) : (
                      <>
                        <th className="p-3">vCPUs</th>
                        <th className="p-3">RAM</th>
                        <th className="p-3">Storage</th>
                      </>
                    )}
                    {showPlanSkuColumn && <th className="p-3">Plan / tier</th>}
                    <th className="p-3">Monthly Cost</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {resources.map(res => (
                    <tr key={res.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-semibold text-slate-850">{res.instanceName}</td>
                      <td className="p-3 text-slate-600">{res.resourceType}</td>
                      <td className="p-3 text-slate-600">{res.tool}</td>
                      <td className="p-3 text-slate-600">{res.environment}</td>
                      {showRegionColumn && (
                        <td className="p-3 text-slate-600">{res.region === 'global' ? '—' : res.region}</td>
                      )}
                      {showSaasInfraColumns ? (
                        <td className="p-3 font-semibold text-indigo-700">
                          {formatBillingSeats(res.billingSeats, res.billingUnit)}
                        </td>
                      ) : (
                        <>
                          <td className="p-3 text-slate-650">{res.vcpus}</td>
                          <td className="p-3 text-slate-650">{res.memory} GB</td>
                          <td className="p-3 text-slate-650">{res.storage} GB</td>
                        </>
                      )}
                      {showPlanSkuColumn && (
                        <td className="p-3 text-slate-600">{res.instanceType || '—'}</td>
                      )}
                      <td className="p-3 font-bold text-slate-800">${res.monthlyCost.toFixed(2)}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded font-black text-[9px] ${
                          res.status === 'RUNNING' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
                        }`}>
                          {res.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => {
                              setEditingResource(res);
                              const loaded = applyProfileToFormFields(
                                {
                                  instanceName: res.instanceName,
                                  resourceType: res.resourceType,
                                  instanceType: res.instanceType || '',
                                  vcpus: String(res.vcpus),
                                  memory: String(res.memory),
                                  storage: String(res.storage),
                                  publicIp: res.publicIp || '',
                                  monthlyCost: String(res.monthlyCost),
                                  billingSeats: res.billingSeats ? String(res.billingSeats) : '',
                                  billingUnit: (res.billingUnit as BillingUnit) || 'users',
                                  status: res.status,
                                  environment: res.environment || 'Production',
                                  region: res.region || 'us-east-1',
                                  tool: res.tool || 'AWS',
                                },
                                res.tool || 'AWS',
                                res.resourceType
                              );
                              setResourceForm(loaded);
                              setPricingNote(null);
                              setCostManuallyEdited(true);
                              setSpecsManuallyEdited(true);
                              setIsResourceModalOpen(true);
                            }}
                            className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteResource(res.id)}
                            className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Invoices Tab */}
        {activeTab === 'invoices' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Upload Area */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              <h3 className="font-black text-slate-800 text-sm">Upload Invoice Statement</h3>
              {showUploadEnvPicker ? (
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-450 block mb-1">
                    Environment {showEnvFilter ? '' : '(optional)'}
                  </label>
                  <select
                    value={uploadEnvironment}
                    onChange={(e) => setUploadEnvironment(e.target.value)}
                    disabled={uploading}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 bg-slate-50"
                  >
                    <option value="">General billing</option>
                    {ENVIRONMENTS.map((env) => (
                      <option key={env} value={env}>{env}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Leave as general billing unless this statement is for a specific environment.
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setTagUploadEnv(true)}
                  disabled={uploading}
                  className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  + Tag by environment (optional)
                </button>
              )}
              <div
                className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer relative bg-slate-50 transition-colors ${
                  isDragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-500'
                }`}
                onDragEnter={(e) => { e.preventDefault(); setIsDragActive(true); }}
                onDragOver={(e) => e.preventDefault()}
                onDragLeave={(e) => { e.preventDefault(); setIsDragActive(false); }}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={uploading}
                />
                <UploadCloud className="text-slate-400 mb-2" size={32} />
                <span className="font-semibold text-slate-700">Drag & drop files or browse</span>
                <span className="text-[10px] text-slate-400 mt-1">Multiple PDF, PNG, or JPEG — up to 10MB each</span>
              </div>

              {uploading && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl text-blue-600 font-semibold animate-pulse">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <span>{uploadProgress}</span>
                </div>
              )}
            </div>

            {/* Invoices List */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h3 className="font-black text-slate-800 text-sm">Parsed Statements History</h3>
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                  {showEnvFilter && (
                    <EnvironmentFilter value={billingEnvironment} onChange={setBillingEnvironment} compact />
                  )}
                  <MonthPeriodFilter value={invoicePeriod} onChange={setInvoicePeriod} compact className="flex-1 sm:max-w-md" />
                </div>
              </div>
              {filteredInvoices.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 border border-slate-100 rounded-xl">
                  <p className="text-slate-400">
                    {invoices.length === 0
                      ? 'No invoices uploaded for this workspace yet.'
                      : 'No invoices match the selected period.'}
                  </p>
                </div>
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-450 font-bold text-left bg-slate-50">
                      <th className="p-3">Invoice #</th>
                      {showEnvColumn && <th className="p-3">Environment</th>}
                      <th className="p-3">Month</th>
                      <th className="p-3">Total Cost</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.map(inv => (
                      <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-3 font-semibold text-slate-800">{inv.invoiceNumber}</td>
                        {showEnvColumn && (
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700">
                              {formatInvoiceEnvironment(inv.environment)}
                            </span>
                          </td>
                        )}
                        <td className="p-3 text-slate-650">{inv.billingMonth || '-'}</td>
                        <td className="p-3 font-bold text-slate-800">{inv.grandTotal.toLocaleString()} {inv.currency}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded font-black text-[9px] bg-blue-50 text-blue-600">
                            {inv.status}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                navigateWithReturn(
                                  navigate,
                                  `/invoices/${inv.id}`,
                                  `/projects/${id}?tab=invoices`,
                                  {
                                    breadcrumbs: projectInvoiceBreadcrumbs(
                                      project?.name || 'Project',
                                      id || '',
                                      inv.invoiceNumber || 'Invoice',
                                      inv.id
                                    ),
                                  }
                                )
                              }
                              className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-blue-600"
                              title="View / Edit"
                            >
                              <Eye size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                navigateWithReturn(
                                  navigate,
                                  `/invoices/${inv.id}`,
                                  `/projects/${id}?tab=invoices`,
                                  {
                                    breadcrumbs: projectInvoiceBreadcrumbs(
                                      project?.name || 'Project',
                                      id || '',
                                      inv.invoiceNumber || 'Invoice',
                                      inv.id
                                    ),
                                  }
                                )
                              }
                              className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800"
                              title="Edit"
                            >
                              <Edit3 size={13} />
                            </button>
                            {inv.originalFilePath && (
                              <a
                                href={`${apiBaseUrl}${inv.originalFilePath}`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-850"
                                title="Download"
                              >
                                <Download size={13} />
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteInvoice(inv.id)}
                              className="p-1.5 rounded hover:bg-red-50 text-slate-500 hover:text-red-600"
                              title="Delete"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Billing Tab */}
        {activeTab === 'billing' && (
          <div className="space-y-6">
            {showEnvFilter && (
              <div className="flex flex-col lg:flex-row gap-3">
                <EnvironmentFilter value={billingEnvironment} onChange={setBillingEnvironment} className="flex-1" />
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2">
                <span className="text-slate-400 font-bold">Aggregated Invoiced Spend</span>
                <p className="text-2xl font-black text-slate-850">
                  ${invoices.reduce((sum, i) => sum + i.grandTotal, 0).toLocaleString()}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2">
                <span className="text-slate-400 font-bold">Active Servers Target Cost</span>
                <p className="text-2xl font-black text-green-600">${totalMonthlyResourceSpend.toFixed(2)}/mo</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2">
                <span className="text-slate-400 font-bold">Invoices Uploaded</span>
                <p className="text-2xl font-black text-slate-850">{invoices.length}</p>
              </div>
            </div>

            <BillingDiscrepancyPanel
              report={discrepancyReport}
              loading={discrepancyLoading}
              projectId={Number(id)}
            />

            <DynamicBillingView view={billingView} loading={billingViewLoading} />
          </div>
        )}
      </div>

      {/* Resource Modal */}
      <AnimatePresence>
        {isResourceModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl w-full max-w-md shadow-xl border border-slate-200 overflow-hidden"
            >
              <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
                <h2 className="font-black text-slate-800 text-sm">
                  {editingResource ? 'Edit Infrastructure Resource' : 'Add Infrastructure Resource'}
                </h2>
                <button
                  onClick={() => setIsResourceModalOpen(false)}
                  className="p-1 rounded hover:bg-slate-200 text-slate-450 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleResourceSubmit} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-600">Resource Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. atg-web-server"
                    value={resourceForm.instanceName}
                    onChange={(e) => setResourceForm({ ...resourceForm, instanceName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-600">Cloud / Tool *</label>
                  <select
                    value={resourceForm.tool}
                    onChange={(e) => handleToolChange(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-blue-500"
                  >
                    {TOOLS_LIST.map((tool) => (
                      <option key={tool} value={tool}>{tool}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 col-span-2 sm:col-span-1">
                    <label className="font-bold text-slate-600">Service / Resource Type *</label>
                    <select
                      value={resourceForm.resourceType}
                      onChange={(e) => handleResourceTypeChange(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white max-h-48"
                    >
                      {(() => {
                        const types = getResourceTypesForTool(resourceForm.tool);
                        const groups = [...new Set(types.map((t) => t.group || 'General'))];
                        const hasCurrent = types.some((t) => t.value === resourceForm.resourceType);
                        return (
                          <>
                            {!hasCurrent && resourceForm.resourceType && (
                              <option value={resourceForm.resourceType}>
                                {resourceForm.resourceType} (saved)
                              </option>
                            )}
                            {groups.map((group) => (
                              <optgroup key={group} label={group}>
                                {types
                                  .filter((t) => (t.group || 'General') === group)
                                  .map((t) => (
                                    <option key={t.value} value={t.value}>
                                      {t.label}
                                    </option>
                                  ))}
                              </optgroup>
                            ))}
                          </>
                        );
                      })()}
                    </select>
                  </div>
                  {resourceProfile.showInstanceSpec && (
                    <div className="space-y-1.5 col-span-2 sm:col-span-1">
                      <label className="font-bold text-slate-600">{resourceProfile.instanceSpecLabel}</label>
                      <input
                        type="text"
                        placeholder={resourceProfile.instanceSpecPlaceholder}
                        value={resourceForm.instanceType}
                        onChange={(e) => {
                          setSpecsManuallyEdited(true);
                          setCostManuallyEdited(false);
                          setResourceForm({ ...resourceForm, instanceType: e.target.value });
                        }}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                      />
                    </div>
                  )}
                  {resourceProfile.showBillingSeats && (
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-600">Billed seats / agents</label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="e.g. 46"
                          value={resourceForm.billingSeats}
                          onChange={(e) => {
                            setCostManuallyEdited(false);
                            setResourceForm({ ...resourceForm, billingSeats: e.target.value });
                          }}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                        />
                        <select
                          value={resourceForm.billingUnit}
                          onChange={(e) =>
                            setResourceForm({ ...resourceForm, billingUnit: e.target.value as BillingUnit })
                          }
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                        >
                          <option value="users">Users</option>
                          <option value="agents">Agents</option>
                          <option value="seats">Seats</option>
                        </select>
                      </div>
                    </div>
                  )}
                  {resourceProfile.showVcpus && (
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-600">vCPUs Count</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={resourceForm.vcpus}
                        onChange={(e) => {
                          setSpecsManuallyEdited(true);
                          setResourceForm({ ...resourceForm, vcpus: e.target.value });
                        }}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                      />
                    </div>
                  )}
                  {resourceProfile.showMemory && (
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-600">{resourceProfile.memoryLabel}</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={resourceForm.memory}
                        onChange={(e) => {
                          setSpecsManuallyEdited(true);
                          setResourceForm({ ...resourceForm, memory: e.target.value });
                        }}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                      />
                    </div>
                  )}
                  {resourceProfile.showStorage && (
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-600">{resourceProfile.storageLabel}</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={resourceForm.storage}
                        onChange={(e) => {
                          setCostManuallyEdited(false);
                          setResourceForm({ ...resourceForm, storage: e.target.value });
                        }}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                      />
                    </div>
                  )}
                  <div className="space-y-1.5 col-span-2">
                    <div className="flex items-center justify-between gap-2">
                      <label className="font-bold text-slate-600">Monthly Cost ($) *</label>
                      <button
                        type="button"
                        onClick={() => lookupPricing(true)}
                        disabled={pricingLoading}
                        className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-700 disabled:opacity-50"
                      >
                        <RefreshCw size={12} className={pricingLoading ? 'animate-spin' : ''} />
                        {pricingLoading ? 'Looking up…' : 'Auto lookup price'}
                      </button>
                    </div>
                    <input
                      type="text"
                      inputMode="decimal"
                      required
                      placeholder="Auto-filled or enter manually"
                      value={resourceForm.monthlyCost}
                      onChange={(e) => {
                        setCostManuallyEdited(true);
                        setResourceForm({ ...resourceForm, monthlyCost: e.target.value });
                      }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                    {pricingNote && (
                      <p className="text-[10px] text-slate-500 leading-snug">{pricingNote}</p>
                    )}
                    {!pricingNote && !pricingLoading && (
                      <p className="text-[10px] text-slate-400">{resourceProfile.pricingHint}</p>
                    )}
                  </div>
                </div>

                <div className={`grid gap-4 ${resourceProfile.showRegion ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-600">Environment *</label>
                    <select
                      value={resourceForm.environment}
                      onChange={(e) => setResourceForm({ ...resourceForm, environment: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-blue-500"
                    >
                      {ENVIRONMENTS.map((env) => (
                        <option key={env} value={env}>{env}</option>
                      ))}
                    </select>
                  </div>
                  {resourceProfile.showRegion && (
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-600">Region *</label>
                      <select
                        value={resourceForm.region}
                        onChange={(e) => setResourceForm({ ...resourceForm, region: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-blue-500"
                      >
                        {REGIONS.map((region) => (
                          <option key={region} value={region}>{region}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {resourceProfile.showIp && (
                    <div className="space-y-1.5 col-span-2">
                      <label className="font-bold text-slate-600">IP Address (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. 164.52.204.208"
                        value={resourceForm.publicIp || ''}
                        onChange={(e) => setResourceForm({ ...resourceForm, publicIp: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                      />
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsResourceModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-50 font-semibold rounded-lg text-slate-550 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                  >
                    Confirm Resource
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Project Edit Modal */}
      <AnimatePresence>
        {isProjectEditOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl w-full max-w-lg shadow-xl border border-slate-200 overflow-hidden"
            >
              <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
                <h2 className="font-black text-slate-800 text-sm">Edit Workspace</h2>
                <button type="button" onClick={() => setIsProjectEditOpen(false)} className="p-1 rounded hover:bg-slate-200 text-slate-450">
                  <X size={16} />
                </button>
              </div>
              <form onSubmit={handleProjectUpdate} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-600">Project Name *</label>
                  <input
                    required
                    value={projectForm.name}
                    onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-600">Owner *</label>
                  <input
                    required
                    value={projectForm.owner}
                    onChange={(e) => setProjectForm({ ...projectForm, owner: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-600">Tool</label>
                  <select
                    value={projectForm.billingProvider}
                    onChange={(e) => setProjectForm({ ...projectForm, billingProvider: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    {TOOLS_LIST.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-600">Description</label>
                  <textarea
                    value={projectForm.description}
                    onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg min-h-[80px]"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setIsProjectEditOpen(false)} className="px-4 py-2 border border-slate-200 rounded-lg font-semibold text-slate-550">
                    Cancel
                  </button>
                  <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold">
                    Save Changes
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
export default ProjectWorkspace;
