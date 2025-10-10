import React, { useState } from 'react';
import { X, Save } from 'lucide-react';

const AddBidSystemForm = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    systemName: '',
    category: 'US State',
    status: 'Pending Registration',
    websiteUrl: '',
    loginUrl: '',
    username: '',
    password: '',
    registrationDate: '',              // NEW: User-entered
    emailAlertsEnabled: 'No',
    alertEmailAddress: 'automation@mymentalarmor.com',
    codeType: 'NAICS',                 // NEW: Type of code
    codeNumbers: '611430',             // NEW: Actual codes
    geographicCoverage: '',
    subscriptionType: 'Free',
    renewalDate: '',
    annualCost: '$0',
    notes: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.systemName || !formData.geographicCoverage) {
      setError('System Name and Geographic Coverage are required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const response = await fetch('/.netlify/functions/addBidSystem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        onSuccess();
      } else {
        setError(data.error || 'Failed to add system');
      }
    } catch (err) {
      setError('Failed to add system: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Add New Bid System</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* System Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              System Name <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              name="systemName"
              value={formData.systemName}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., California State Purchasing"
              required
            />
          </div>

          {/* Geographic Coverage */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Geographic Coverage <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              name="geographicCoverage"
              value={formData.geographicCoverage}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., California, United States, International"
              required
            />
          </div>

          {/* Category & Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="US Federal">US Federal</option>
                <option value="US State">US State</option>
                <option value="US Territory">US Territory</option>
                <option value="Local/County">Local/County</option>
                <option value="International">International</option>
                <option value="Private/Commercial">Private/Commercial</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="Pending Registration">Pending Registration</option>
                <option value="Active">Active</option>
                <option value="Access Issues">Access Issues</option>
              </select>
            </div>
          </div>

          {/* Registration Date - NEW */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Registration Date
            </label>
            <input
              type="date"
              name="registrationDate"
              value={formData.registrationDate}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">When you originally registered with this system</p>
          </div>

          {/* URLs */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Website URL</label>
            <input
              type="url"
              name="websiteUrl"
              value={formData.websiteUrl}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Login URL</label>
            <input
              type="url"
              name="loginUrl"
              value={formData.loginUrl}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="https://..."
            />
          </div>

          {/* Credentials */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Commodity Codes - UPDATED */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code Type</label>
              <select
                name="codeType"
                value={formData.codeType}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">None</option>
                <option value="NAICS">NAICS</option>
                <option value="NIGP">NIGP</option>
                <option value="UNSPSC">UNSPSC</option>
                <option value="PSC">PSC (Federal)</option>
                <option value="SIN">SIN (GSA Schedule)</option>
                <option value="FSC">FSC (Federal Supply Class)</option>
                <option value="Custom">Custom/Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code Numbers</label>
              <input
                type="text"
                name="codeNumbers"
                value={formData.codeNumbers}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., 611430, 54151S"
              />
              <p className="text-xs text-gray-500 mt-1">Comma-separated if multiple</p>
            </div>
          </div>

          {/* Email Alerts */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Alerts</label>
              <select
                name="emailAlertsEnabled"
                value={formData.emailAlertsEnabled}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Alert Email</label>
              <input
                type="email"
                name="alertEmailAddress"
                value={formData.alertEmailAddress}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Subscription Details */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subscription Type</label>
              <select
                name="subscriptionType"
                value={formData.subscriptionType}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="Free">Free</option>
                <option value="Paid">Paid</option>
                <option value="Trial">Trial</option>
                <option value="Enterprise">Enterprise</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Renewal Date</label>
              <input
                type="date"
                name="renewalDate"
                value={formData.renewalDate}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Annual Cost</label>
              <input
                type="text"
                name="annualCost"
                value={formData.annualCost}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="$0"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Vendor numbers, security questions, special instructions, etc."
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Save size={20} />
              {saving ? 'Saving...' : 'Save System'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddBidSystemForm;