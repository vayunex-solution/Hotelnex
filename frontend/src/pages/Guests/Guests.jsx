import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api.js';
import { 
  Users, Plus, Edit, X, Loader2, Search, MapPin, Phone, 
  User, ExternalLink, FileText, Image as ImageIcon, AlertCircle, 
  Check, Eye, EyeOff, ShieldCheck
} from 'lucide-react';

const Guests = () => {
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modals state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [selectedPreview, setSelectedPreview] = useState(null); // { url, type, title }

  // Search filter
  const [searchTerm, setSearchTerm] = useState('');

  // Forms state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [driveLink, setDriveLink] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [idFrontFile, setIdFrontFile] = useState(null);
  const [idBackFile, setIdBackFile] = useState(null);

  const [selectedGuest, setSelectedGuest] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // ─── Fetch Guests ──────────────────────────────────────────────────────────
  const fetchGuests = useCallback(async (searchQuery = '') => {
    setLoading(true);
    setError('');
    try {
      const url = searchQuery.trim() ? `/guests?search=${encodeURIComponent(searchQuery)}` : '/guests';
      const res = await api.get(url);
      setGuests(res.data.data || []);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch guests list. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGuests();
  }, [fetchGuests]);

  // Handle live search with simple debounce/trigger
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchGuests(searchTerm);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    fetchGuests('');
  };

  // ─── Add Guest Submission ─────────────────────────────────────────────────
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!fullName.trim() || !phone.trim()) {
      setFormError('Full name and phone number are required.');
      return;
    }

    setFormLoading(true);
    try {
      const formData = new FormData();
      formData.append('full_name', fullName.trim());
      formData.append('phone_number', phone.trim());
      formData.append('address', address.trim());
      formData.append('document_url', driveLink.trim());
      
      if (photoFile) formData.append('guest_photo', photoFile);
      if (idFrontFile) formData.append('id_front', idFrontFile);
      if (idBackFile) formData.append('id_back', idBackFile);

      await api.post('/guests', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setSuccess('Guest profile registered successfully!');
      setAddModalOpen(false);
      fetchGuests(searchTerm);

      // Clear Form
      setFullName('');
      setPhone('');
      setAddress('');
      setDriveLink('');
      setPhotoFile(null);
      setIdFrontFile(null);
      setIdBackFile(null);
    } catch (err) {
      console.error(err);
      setFormError(err.response?.data?.message || 'Failed to register guest.');
    } finally {
      setFormLoading(false);
    }
  };

  // ─── Edit Guest Setup ──────────────────────────────────────────────────────
  const openEditModal = (guest) => {
    setSelectedGuest(guest);
    setFullName(guest.full_name || '');
    setPhone(guest.phone_number || '');
    setAddress(guest.address || '');
    setDriveLink(guest.document_url || '');
    setPhotoFile(null);
    setIdFrontFile(null);
    setIdBackFile(null);
    setFormError('');
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!fullName.trim() || !phone.trim()) {
      setFormError('Full name and phone number are required.');
      return;
    }

    setFormLoading(true);
    try {
      const formData = new FormData();
      formData.append('full_name', fullName.trim());
      formData.append('phone_number', phone.trim());
      formData.append('address', address.trim());
      formData.append('document_url', driveLink.trim());

      if (photoFile) formData.append('guest_photo', photoFile);
      if (idFrontFile) formData.append('id_front', idFrontFile);
      if (idBackFile) formData.append('id_back', idBackFile);

      await api.put(`/guests/${selectedGuest.id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setSuccess('Guest profile updated successfully!');
      setEditModalOpen(false);
      fetchGuests(searchTerm);
    } catch (err) {
      console.error(err);
      setFormError(err.response?.data?.message || 'Failed to update guest details.');
    } finally {
      setFormLoading(false);
    }
  };

  // ─── Document Preview Setup ────────────────────────────────────────────────
  const triggerPreview = (filePath, docName) => {
    if (!filePath) return;
    const isPdf = filePath.toLowerCase().endsWith('.pdf');
    setSelectedPreview({
      url: filePath,
      type: isPdf ? 'pdf' : 'image',
      title: docName
    });
    setPreviewModalOpen(true);
  };

  // Clear global notifications after 3 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
            <Users className="w-8 h-8 text-indigo-400" />
            Guests Directory
          </h1>
          <p className="text-slate-400 text-sm mt-1">Manage guest records, documents, and cloud storage folders.</p>
        </div>
        
        <button
          onClick={() => {
            setFormError('');
            setFullName('');
            setPhone('');
            setAddress('');
            setDriveLink('');
            setPhotoFile(null);
            setIdFrontFile(null);
            setIdBackFile(null);
            setAddModalOpen(true);
          }}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
        >
          <Plus className="w-4.5 h-4.5" />
          Add New Guest
        </button>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
          <input 
            type="text" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, phone, or address..."
            className="w-full bg-slate-900 border border-slate-800 text-white text-sm rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-indigo-500 transition-all"
          />
        </div>
        <button
          type="submit"
          className="px-6 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-sm font-semibold transition-colors"
        >
          Search
        </button>
        {searchTerm && (
          <button
            type="button"
            onClick={handleClearSearch}
            className="px-4 bg-slate-800/40 hover:bg-slate-800 border border-slate-800 text-slate-400 rounded-xl text-sm transition-colors"
          >
            Clear
          </button>
        )}
      </form>

      {/* Notifications */}
      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm flex items-center gap-2.5">
          <Check className="w-5 h-5" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 animate-pulse" />
          <span>{error}</span>
        </div>
      )}

      {/* Guests list */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          <span className="text-slate-400 text-sm font-medium">Fetching guest records...</span>
        </div>
      ) : guests.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl py-20 text-center">
          <Users className="w-12 h-12 text-slate-700 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-300">No guests found</h3>
          <p className="text-slate-500 text-sm mt-1">Add guest entries or search with another term.</p>
        </div>
      ) : (
        <>
          {/* ── MOBILE CARD VIEW (< md) ─────────────────── */}
          <div className="md:hidden space-y-4">
            {guests.map((guest) => (
              <div key={guest.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold cursor-pointer hover:bg-indigo-600 hover:text-white transition-all overflow-hidden shrink-0"
                    onClick={() => { if (guest.guest_photo) triggerPreview(guest.guest_photo, `${guest.full_name}'s Photo`); }}
                  >
                    {guest.guest_photo ? <img src={guest.guest_photo} alt="" className="w-full h-full object-cover" /> : <User className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-white text-base truncate">{guest.full_name}</p>
                    <p className="text-xs text-indigo-400 font-semibold flex items-center gap-1 mt-0.5"><ShieldCheck className="w-3 h-3" />GST-{guest.id}</p>
                  </div>
                  <button onClick={() => openEditModal(guest)} className="w-9 h-9 bg-slate-800 border border-slate-700 text-slate-400 hover:text-white rounded-lg flex items-center justify-center transition-all shrink-0"><Edit className="w-4 h-4" /></button>
                </div>
                <div className="space-y-1 text-sm">
                  <p className="flex items-center gap-1.5 text-slate-300"><Phone className="w-3.5 h-3.5 text-slate-500" />{guest.phone_number}</p>
                  <p className="flex items-center gap-1.5 text-xs text-slate-400"><MapPin className="w-3.5 h-3.5 text-slate-500" />{guest.address || 'Address not listed'}</p>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-slate-800 flex-wrap">
                  {guest.document_url ? (
                    <a href={guest.document_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-semibold hover:bg-emerald-500 hover:text-white transition-all"><ExternalLink className="w-3 h-3" />Drive</a>
                  ) : <span className="text-xs text-slate-600 italic">No drive link</span>}
                  <button disabled={!guest.guest_photo} onClick={() => triggerPreview(guest.guest_photo, `${guest.full_name}'s Photo`)} className={`px-2 py-1 rounded-md text-xs font-semibold border flex items-center gap-1 ${guest.guest_photo ? 'bg-slate-800 text-indigo-400 border-indigo-500/20 cursor-pointer' : 'bg-slate-900/50 text-slate-600 border-slate-800/40'}`}><ImageIcon className="w-3 h-3" />Photo</button>
                  <button disabled={!guest.id_front} onClick={() => triggerPreview(guest.id_front, `${guest.full_name}'s ID Front`)} className={`px-2 py-1 rounded-md text-xs font-semibold border flex items-center gap-1 ${guest.id_front ? 'bg-slate-800 text-indigo-400 border-indigo-500/20 cursor-pointer' : 'bg-slate-900/50 text-slate-600 border-slate-800/40'}`}><FileText className="w-3 h-3" />ID Front</button>
                  <button disabled={!guest.id_back} onClick={() => triggerPreview(guest.id_back, `${guest.full_name}'s ID Back`)} className={`px-2 py-1 rounded-md text-xs font-semibold border flex items-center gap-1 ${guest.id_back ? 'bg-slate-800 text-indigo-400 border-indigo-500/20 cursor-pointer' : 'bg-slate-900/50 text-slate-600 border-slate-800/40'}`}><FileText className="w-3 h-3" />ID Back</button>
                </div>
              </div>
            ))}
          </div>

          {/* ── DESKTOP TABLE VIEW (≥ md) ─────────────── */}
          <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="border-b border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-800/20">
                    <th className="px-6 py-4">Guest Details</th>
                    <th className="px-6 py-4">Contact &amp; Location</th>
                    <th className="px-6 py-4">Google Drive</th>
                    <th className="px-6 py-4">KYC Documents</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-800 text-sm text-slate-300">
                   {guests.map((guest) => (
                    <tr key={guest.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold cursor-pointer hover:bg-indigo-600 hover:text-white transition-all overflow-hidden" onClick={() => { if (guest.guest_photo) triggerPreview(guest.guest_photo, `${guest.full_name}'s Photo`); }} title={guest.guest_photo ? 'Click to view photo' : 'No photo uploaded'}>
                            {guest.guest_photo ? <img src={guest.guest_photo} alt="" className="w-full h-full object-cover" /> : <User className="w-5 h-5" />}
                          </div>
                          <div>
                            <p className="font-bold text-white text-base">{guest.full_name}</p>
                            <p className="text-[10px] text-indigo-400 font-semibold tracking-wide uppercase flex items-center gap-1 mt-0.5"><ShieldCheck className="w-3.5 h-3.5" />ID: GST-{guest.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 space-y-1">
                        <p className="font-medium text-slate-200 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-slate-500" />{guest.phone_number}</p>
                        <p className="text-xs text-slate-400 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-slate-500" />{guest.address || 'Address not listed'}</p>
                      </td>
                      <td className="px-6 py-4">
                        {guest.document_url ? (
                          <a href={guest.document_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-semibold hover:bg-emerald-500 hover:text-white shadow-sm hover:shadow-emerald-500/20 transition-all cursor-pointer"><ExternalLink className="w-3.5 h-3.5" />Drive Folder</a>
                        ) : <span className="text-xs text-slate-500 italic font-medium">Link not configured</span>}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button disabled={!guest.guest_photo} onClick={() => triggerPreview(guest.guest_photo, `${guest.full_name}'s Photo`)} className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-all flex items-center gap-1 ${guest.guest_photo ? 'bg-slate-800 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/10 cursor-pointer' : 'bg-slate-900/50 text-slate-600 border-slate-800/40 cursor-default'}`}><ImageIcon className="w-3 h-3" />Photo</button>
                          <button disabled={!guest.id_front} onClick={() => triggerPreview(guest.id_front, `${guest.full_name}'s ID Front`)} className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-all flex items-center gap-1 ${guest.id_front ? 'bg-slate-800 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/10 cursor-pointer' : 'bg-slate-900/50 text-slate-600 border-slate-800/40 cursor-default'}`}><FileText className="w-3 h-3" />ID Front</button>
                          <button disabled={!guest.id_back} onClick={() => triggerPreview(guest.id_back, `${guest.full_name}'s ID Back`)} className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-all flex items-center gap-1 ${guest.id_back ? 'bg-slate-800 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/10 cursor-pointer' : 'bg-slate-900/50 text-slate-600 border-slate-800/40 cursor-default'}`}><FileText className="w-3 h-3" />ID Back</button>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => openEditModal(guest)} className="w-9 h-9 bg-slate-800 border border-slate-700 text-slate-400 hover:text-white rounded-lg flex items-center justify-center transition-all ml-auto cursor-pointer" title="Edit Profile & KYC"><Edit className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                 </tbody>
               </table>
             </div>
           </div>
         </>
      )}

      {/* ─── Add Guest Modal ───────────────────────────────────────────────── */}
      {addModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl p-6 relative my-8">
            <button 
              onClick={() => setAddModalOpen(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-400" />
              Register New Guest
            </h2>
            
            {formError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Full Name *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3.5 w-4.5 h-4.5 text-slate-500" />
                    <input 
                      type="text" 
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Grand Guest Name"
                      className="w-full bg-slate-800/60 border border-slate-700 text-white text-sm rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Phone Number *</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3.5 w-4.5 h-4.5 text-slate-500" />
                    <input 
                      type="text" 
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className="w-full bg-slate-800/60 border border-slate-700 text-white text-sm rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Home Address</label>
                <input 
                  type="text" 
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="City, State, Country"
                  className="w-full bg-slate-800/60 border border-slate-700 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Google Drive Link (Documents Folder)</label>
                <input 
                  type="url" 
                  value={driveLink}
                  onChange={(e) => setDriveLink(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/..."
                  className="w-full bg-slate-800/60 border border-slate-700 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="border-t border-slate-800 pt-4 space-y-3">
                <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">KYC Document Uploads (Optional)</h3>
                
                {/* Photo */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Guest Photo</label>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => setPhotoFile(e.target.files[0])}
                    className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 file:cursor-pointer cursor-pointer border border-slate-700 p-1.5 rounded-xl bg-slate-800/10"
                  />
                </div>

                {/* ID Front */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Government ID (Front Side)</label>
                  <input 
                    type="file" 
                    accept="image/*,application/pdf"
                    onChange={(e) => setIdFrontFile(e.target.files[0])}
                    className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 file:cursor-pointer cursor-pointer border border-slate-700 p-1.5 rounded-xl bg-slate-800/10"
                  />
                </div>

                {/* ID Back */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Government ID (Back Side)</label>
                  <input 
                    type="file" 
                    accept="image/*,application/pdf"
                    onChange={(e) => setIdBackFile(e.target.files[0])}
                    className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 file:cursor-pointer cursor-pointer border border-slate-700 p-1.5 rounded-xl bg-slate-800/10"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="flex-1 py-3 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-xl text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  {formLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Register Guest
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Edit Guest Modal ──────────────────────────────────────────────── */}
      {editModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl p-6 relative my-8">
            <button 
              onClick={() => setEditModalOpen(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Edit className="w-5 h-5 text-indigo-400" />
              Edit Guest: {selectedGuest?.full_name}
            </h2>
            
            {formError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Full Name *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3.5 w-4.5 h-4.5 text-slate-500" />
                    <input 
                      type="text" 
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Grand Guest Name"
                      className="w-full bg-slate-800/60 border border-slate-700 text-white text-sm rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Phone Number *</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3.5 w-4.5 h-4.5 text-slate-500" />
                    <input 
                      type="text" 
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className="w-full bg-slate-800/60 border border-slate-700 text-white text-sm rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Home Address</label>
                <input 
                  type="text" 
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="City, State, Country"
                  className="w-full bg-slate-800/60 border border-slate-700 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Google Drive Link (Documents Folder)</label>
                <input 
                  type="url" 
                  value={driveLink}
                  onChange={(e) => setDriveLink(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/..."
                  className="w-full bg-slate-800/60 border border-slate-700 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="border-t border-slate-800 pt-4 space-y-3">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Update KYC Documents</h3>
                  <span className="text-[10px] text-slate-500 font-semibold">(Leave blank to keep existing files)</span>
                </div>
                
                {/* Photo */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Guest Photo {selectedGuest?.guest_photo && <span className="text-emerald-400">(✓ Currently Uploaded)</span>}
                  </label>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => setPhotoFile(e.target.files[0])}
                    className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 file:cursor-pointer cursor-pointer border border-slate-700 p-1.5 rounded-xl bg-slate-800/10"
                  />
                </div>

                {/* ID Front */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Government ID (Front Side) {selectedGuest?.id_front && <span className="text-emerald-400">(✓ Currently Uploaded)</span>}
                  </label>
                  <input 
                    type="file" 
                    accept="image/*,application/pdf"
                    onChange={(e) => setIdFrontFile(e.target.files[0])}
                    className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 file:cursor-pointer cursor-pointer border border-slate-700 p-1.5 rounded-xl bg-slate-800/10"
                  />
                </div>

                {/* ID Back */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Government ID (Back Side) {selectedGuest?.id_back && <span className="text-emerald-400">(✓ Currently Uploaded)</span>}
                  </label>
                  <input 
                    type="file" 
                    accept="image/*,application/pdf"
                    onChange={(e) => setIdBackFile(e.target.files[0])}
                    className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 file:cursor-pointer cursor-pointer border border-slate-700 p-1.5 rounded-xl bg-slate-800/10"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="flex-1 py-3 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-xl text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  {formLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Document Preview Modal ────────────────────────────────────────── */}
      {previewModalOpen && selectedPreview && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden relative">
            <header className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/60 backdrop-blur-md shrink-0">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-4.5 h-4.5 text-indigo-400" />
                {selectedPreview.title}
              </h3>
              <div className="flex items-center gap-3">
                <a 
                  href={selectedPreview.url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open Direct
                </a>
                <button 
                  onClick={() => {
                    setPreviewModalOpen(false);
                    setSelectedPreview(null);
                  }}
                  className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>
            </header>

            <div className="flex-1 bg-slate-950 p-6 flex items-center justify-center overflow-auto">
              {selectedPreview.type === 'pdf' ? (
                <iframe 
                  src={selectedPreview.url} 
                  title="PDF Document" 
                  className="w-full h-full border-0 rounded-xl"
                />
              ) : (
                <img 
                  src={selectedPreview.url} 
                  alt="KYC Document Preview" 
                  className="max-w-full max-h-full object-contain rounded-xl shadow-lg border border-slate-800"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Guests;
