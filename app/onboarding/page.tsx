"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveNPOProfile, type NPOProfile } from "../lib/api";

const ISSUE_AREAS = [
  "community",
  "education", 
  "youth",
  "health",
  "arts_culture",
  "ageing",
  "employment",
  "sports",
  "digital_tech",
  "disability_inclusion",
  "environment"
];

const PROJECT_TYPES = [
  "project_based",
  "training_manpower",
  "research_evaluation",
  "operations_support",
  "equipment_capex"
];

// Display labels for better UX
const ISSUE_AREA_LABELS: Record<string, string> = {
  "community": "Community",
  "education": "Education",
  "youth": "Youth",
  "health": "Health",
  "arts_culture": "Arts & Culture",
  "ageing": "Ageing",
  "employment": "Employment",
  "sports": "Sports",
  "digital_tech": "Digital & Tech",
  "disability_inclusion": "Disability & Inclusion",
  "environment": "Environment"
};

const PROJECT_TYPE_LABELS: Record<string, string> = {
  "project_based": "Project / Programme",
  "training_manpower": "Manpower & Training",
  "research_evaluation": "Research & Evaluation",
  "operations_support": "Operations Support",
  "equipment_capex": "Equipment & CapEx"
};

const ORGANIZATION_TYPES = [
  "Registered Charity",
  "IPC (Institution of a Public Character)",
  "Social Enterprise",
  "Community Group",
  "Educational Institution"
];

const FUNDING_URGENCY = [
  { value: "high", label: "Urgent (Within 3 months)" },
  { value: "medium", label: "Moderate (3-6 months)" },
  { value: "low", label: "Flexible (6+ months)" }
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Profile fields matching backend NPOProfile
  const [organizationName, setOrganizationName] = useState("");
  const [organizationType, setOrganizationType] = useState("");
  const [issueAreas, setIssueAreas] = useState<string[]>([]);
  const [projectTypes, setProjectTypes] = useState<string[]>([]);
  const [fundingMin, setFundingMin] = useState(0);
  const [fundingMax, setFundingMax] = useState(100000);
  const [fundingUrgency, setFundingUrgency] = useState("medium");
  const [yearsOperating, setYearsOperating] = useState(1);
  const [staffSize, setStaffSize] = useState(5);
  const [mission, setMission] = useState("");

  // Error states
  const [errors, setErrors] = useState<Record<number, string>>({});

  const toggleItem = (list: string[], item: string, setter: (val: string[]) => void) => {
    if (list.includes(item)) {
      setter(list.filter((i) => i !== item));
    } else {
      setter([...list, item]);
    }
  };

  const validateStep = (currentStep: number): boolean => {
    const newErrors: Record<number, string> = { ...errors };
    
    switch (currentStep) {
      case 1:
        if (!organizationName.trim()) {
          newErrors[1] = "Organization name is required";
          setErrors(newErrors);
          return false;
        }
        if (!organizationType) {
          newErrors[1] = "Please select an organization type";
          setErrors(newErrors);
          return false;
        }
        break;
      
      case 2:
        if (issueAreas.length === 0) {
          newErrors[2] = "Please select at least one issue area";
          setErrors(newErrors);
          return false;
        }
        break;
      
      case 3:
        if (projectTypes.length === 0) {
          newErrors[3] = "Please select at least one project type";
          setErrors(newErrors);
          return false;
        }
        break;
      
      case 4:
        if (fundingMin >= fundingMax) {
          newErrors[4] = "Maximum funding must be greater than minimum funding";
          setErrors(newErrors);
          return false;
        }
        break;
      
      case 6:
        if (yearsOperating < 0) {
          newErrors[6] = "Years operating cannot be negative";
          setErrors(newErrors);
          return false;
        }
        if (staffSize < 1) {
          newErrors[6] = "Staff size must be at least 1";
          setErrors(newErrors);
          return false;
        }
        if (!mission.trim()) {
          newErrors[6] = "Please describe your organization's mission";
          setErrors(newErrors);
          return false;
        }
        if (mission.trim().length < 20) {
          newErrors[6] = "Mission description should be at least 20 characters";
          setErrors(newErrors);
          return false;
        }
        break;
    }
    
    // Clear error for this step if validation passed
    delete newErrors[currentStep];
    setErrors(newErrors);
    return true;
  };

  const next = () => {
    if (validateStep(step)) {
      setStep((s) => s + 1);
    }
  };
  
  const back = () => {
    // Clear error when going back
    const newErrors = { ...errors };
    delete newErrors[step];
    setErrors(newErrors);
    setStep((s) => s - 1);
  };

  const handleFinish = async () => {
    if (!validateStep(6)) {
      return;
    }
    
    setSaving(true);
    try {
      const profile: NPOProfile = {
        organization_name: organizationName,
        organization_type: organizationType,
        issue_areas: issueAreas,
        project_types: projectTypes,
        funding_min: fundingMin,
        funding_max: fundingMax,
        funding_urgency: fundingUrgency,
        years_operating: yearsOperating,
        staff_size: staffSize,
        mission: mission,
        description: "",
      };

      const result = await saveNPOProfile(profile);
      if (result.user_id) {
        localStorage.setItem("user_id", result.user_id);
      }
      router.push("/match");
    } catch (error) {
      console.error("Failed to save profile:", error);
      const newErrors = { ...errors };
      newErrors[6] = "Failed to save profile. Please try again.";
      setErrors(newErrors);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-100 px-4 py-8">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 flex flex-col" style={{ minHeight: '600px' }}>
        
        {/* Progress */}
        <div className="flex gap-2 mb-6">
          {[1, 2, 3, 4, 5, 6].map((s) => (
            <div key={s} className={`h-2 flex-1 rounded-full ${step >= s ? "bg-indigo-500" : "bg-gray-200"}`} />
          ))}
        </div>

        {/* STEP 1 */}
        {step === 1 && (
          <div className="flex-1 flex flex-col justify-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Tell us about your organization</h2>
            {errors[1] && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600 flex items-center gap-2">
                  <span className="font-bold">⚠</span> {errors[1]}
                </p>
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Organization Name <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  value={organizationName} 
                  onChange={(e) => setOrganizationName(e.target.value)} 
                  placeholder="e.g. Hope Community Services" 
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                    errors[1] && !organizationName.trim() 
                      ? 'border-red-300 focus:ring-red-400' 
                      : 'border-gray-300 focus:ring-indigo-400'
                  }`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Organization Type <span className="text-red-500">*</span>
                </label>
                <select 
                  value={organizationType} 
                  onChange={(e) => setOrganizationType(e.target.value)} 
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                    errors[1] && !organizationType 
                      ? 'border-red-300 focus:ring-red-400' 
                      : 'border-gray-300 focus:ring-indigo-400'
                  }`}
                >
                  <option value="">Select type...</option>
                  {ORGANIZATION_TYPES.map((type) => (<option key={type} value={type}>{type}</option>))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              What issue areas do you focus on? <span className="text-red-500">*</span>
            </h2>
            <p className="text-sm text-gray-500 mb-4">Select all that apply (30% of matching score)</p>
            {errors[2] && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600 flex items-center gap-2">
                  <span className="font-bold">⚠</span> {errors[2]}
                </p>
              </div>
            )}
            {issueAreas.length > 0 && (
              <p className="text-sm text-indigo-600 font-medium mb-2">
                ✓ {issueAreas.length} area{issueAreas.length > 1 ? 's' : ''} selected
              </p>
            )}
            <div className="flex flex-wrap gap-2 overflow-y-auto flex-1">
              {ISSUE_AREAS.map((area) => (
                <button key={area} onClick={() => toggleItem(issueAreas, area, setIssueAreas)} className={`px-4 py-2 rounded-full text-sm transition h-fit ${issueAreas.includes(area) ? "bg-indigo-600 text-white" : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"}`}>{ISSUE_AREA_LABELS[area]}</button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              What types of projects do you run? <span className="text-red-500">*</span>
            </h2>
            <p className="text-sm text-gray-500 mb-4">Select all that apply (20% of matching score)</p>
            {errors[3] && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600 flex items-center gap-2">
                  <span className="font-bold">⚠</span> {errors[3]}
                </p>
              </div>
            )}
            {projectTypes.length > 0 && (
              <p className="text-sm text-green-600 font-medium mb-2">
                ✓ {projectTypes.length} type{projectTypes.length > 1 ? 's' : ''} selected
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {PROJECT_TYPES.map((type) => (
                <button key={type} onClick={() => toggleItem(projectTypes, type, setProjectTypes)} className={`px-4 py-2 rounded-full text-sm transition ${projectTypes.includes(type) ? "bg-green-600 text-white" : "bg-green-100 text-green-700 hover:bg-green-200"}`}>{PROJECT_TYPE_LABELS[type]}</button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 4 */}
        {step === 4 && (
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">What's your funding range?</h2>
            <p className="text-sm text-gray-500 mb-4">This affects 20% of your match score</p>
            {errors[4] && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600 flex items-center gap-2">
                  <span className="font-bold">⚠</span> {errors[4]}
                </p>
              </div>
            )}
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                <p className="text-sm text-gray-600 mb-2">Minimum Funding</p>
                <p className="text-2xl font-bold text-blue-700 mb-4">${fundingMin.toLocaleString()}</p>
                <input type="range" min={0} max={100000} step={5000} value={fundingMin} onChange={(e) => setFundingMin(Number(e.target.value))} className="w-full" />
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-6">
                <p className="text-sm text-gray-600 mb-2">Maximum Funding</p>
                <p className="text-2xl font-bold text-purple-700 mb-4">${fundingMax.toLocaleString()}</p>
                <input type="range" min={10000} max={500000} step={10000} value={fundingMax} onChange={(e) => setFundingMax(Number(e.target.value))} className="w-full" />
              </div>
            </div>
          </div>
        )}

        {/* STEP 5 */}
        {step === 5 && (
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">How urgent is your funding need?</h2>
            <p className="text-sm text-gray-500 mb-6">This affects 10% of your match score</p>
            <div className="space-y-3">
              {FUNDING_URGENCY.map((option) => (
                <button key={option.value} onClick={() => setFundingUrgency(option.value)} className={`w-full p-4 rounded-lg border-2 text-left transition ${fundingUrgency === option.value ? "border-indigo-600 bg-indigo-50" : "border-gray-200 hover:border-indigo-300"}`}>
                  <div className="font-semibold text-gray-800">{option.label}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 6 */}
        {step === 6 && (
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Final details</h2>
            <p className="text-sm text-gray-500 mb-4">Help us understand your organization better (5% of match score)</p>
            {errors[6] && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600 flex items-center gap-2">
                  <span className="font-bold">⚠</span> {errors[6]}
                </p>
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Years Operating <span className="text-red-500">*</span>
                </label>
                <input 
                  type="number" 
                  min="0" 
                  value={yearsOperating} 
                  onChange={(e) => setYearsOperating(Number(e.target.value))} 
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                    errors[6] && yearsOperating < 0
                      ? 'border-red-300 focus:ring-red-400' 
                      : 'border-gray-300 focus:ring-indigo-400'
                  }`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Staff Size <span className="text-red-500">*</span>
                </label>
                <input 
                  type="number" 
                  min="1" 
                  value={staffSize} 
                  onChange={(e) => setStaffSize(Number(e.target.value))} 
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                    errors[6] && staffSize < 1
                      ? 'border-red-300 focus:ring-red-400' 
                      : 'border-gray-300 focus:ring-indigo-400'
                  }`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mission & Goals <span className="text-red-500">*</span>
                </label>
                <textarea 
                  placeholder="Briefly describe your organization's mission and strategic goals (min. 20 characters)..." 
                  value={mission} 
                  onChange={(e) => setMission(e.target.value)} 
                  className={`w-full h-24 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 text-sm ${
                    errors[6] && (!mission.trim() || mission.trim().length < 20)
                      ? 'border-red-300 focus:ring-red-400' 
                      : 'border-gray-300 focus:ring-indigo-400'
                  }`}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {mission.length} / 20 characters minimum
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          {step > 1 ? (
            <button onClick={back} className="px-4 py-2 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200">Back</button>
          ) : (<div />)}
          {step < 6 ? (
            <button onClick={next} className="px-6 py-2 rounded-full bg-indigo-600 text-white hover:bg-indigo-700">Next</button>
          ) : (
            <button onClick={handleFinish} disabled={saving} className="px-6 py-2 rounded-full bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed">
              {saving ? "Saving..." : "Start Swiping →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
