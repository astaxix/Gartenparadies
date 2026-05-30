import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Leaf, ArrowLeft, Loader2, FileText, CheckCircle2 } from 'lucide-react';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    vatId: '',
    street: '',
    postalCode: '',
    city: '',
    country: 'Deutschland',
    username: '',
    email: '',
    password: '',
    passwordRepeat: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.passwordRepeat) {
      setError('Die Passwörter stimmen nicht überein.');
      return;
    }

    try {
      setIsLoading(true);
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;
      
      const userDocRef = doc(db, 'users', user.uid);
      const userData = {
        id: user.uid,
        username: formData.username,
        displayName: formData.name,
        email: formData.email,
        company: formData.company,
        vatId: formData.vatId,
        address: {
          street: formData.street,
          postalCode: formData.postalCode,
          city: formData.city,
          country: formData.country
        }
      };
      await setDoc(userDocRef, userData);

      setSuccess(true);
      setTimeout(() => {
        navigate('/');
      }, 1500);

    } catch (err: any) {
      console.error(err);
      let errorMsg = 'Ein Fehler ist aufgetreten. Bitte versuche es später erneut.';
      if (err.code === 'auth/email-already-in-use') {
         errorMsg = 'Diese E-Mail-Adresse wird bereits verwendet.';
      } else if (err.code === 'auth/weak-password') {
         errorMsg = 'Das Passwort sollte mindestens 6 Zeichen lang sein.';
      }
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center fade-in zoom-in">
          <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Registrierung erfolgreich!</h2>
          <p className="text-gray-600">Du wirst in Kürze weitergeleitet...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-2xl mx-auto">
        <button 
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-slate-500 hover:text-emerald-700 transition-colors mb-6 font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Zurück zur Startseite</span>
        </button>

        <div className="bg-white rounded-[2rem] shadow-xl overflow-hidden border border-gray-100/50">
          <div className="bg-emerald-800 px-8 py-10 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 -mr-16 -mt-16 text-white/5 rotate-12">
               <Leaf className="w-48 h-48" />
            </div>
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-sm border border-white/20 shadow-inner">
                <FileText className="w-8 h-8 text-emerald-50" />
              </div>
              <h2 className="text-3xl font-extrabold text-white tracking-tight">Konto erstellen</h2>
              <p className="text-emerald-100 mt-2 text-sm font-medium opacity-90 max-w-sm">
                Gestalte und verwalte deine Bewässerungssysteme mit einem eigenen Fach-Konto.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-8">
            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium border border-red-100 flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-red-600 block shrink-0 animate-pulse"></span>
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8">
              
              <div className="md:col-span-2">
                <h3 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-2 mb-4">Persönliche Daten</h3>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Vor- und Nachname *</label>
                <input required name="name" value={formData.name} onChange={handleChange} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all shadow-sm" placeholder="Max Mustermann" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Firma <span className="text-gray-400 font-normal normal-case">(optional)</span></label>
                <input name="company" value={formData.company} onChange={handleChange} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all shadow-sm" placeholder="Mustermann GmbH" />
              </div>
              {formData.company && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">USt-IdNr. <span className="text-gray-400 font-normal normal-case">(optional)</span></label>
                  <input name="vatId" value={formData.vatId} onChange={handleChange} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all shadow-sm" placeholder="DE123456789" />
                </div>
              )}

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Straße & Hausnummer *</label>
                <input required name="street" value={formData.street} onChange={handleChange} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all shadow-sm" placeholder="Musterstraße 12" />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">PLZ *</label>
                <input required name="postalCode" value={formData.postalCode} onChange={handleChange} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all shadow-sm" placeholder="12345" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Ort *</label>
                <input required name="city" value={formData.city} onChange={handleChange} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all shadow-sm" placeholder="Musterstadt" />
              </div>

              <div className="md:col-span-2">
                 <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Land</label>
                 <select name="country" value={formData.country} onChange={handleChange} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all shadow-sm appearance-none">
                    <option>Deutschland</option>
                    <option>Österreich</option>
                    <option>Schweiz</option>
                 </select>
              </div>

              <div className="md:col-span-2 mt-4">
                <h3 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-2 mb-4">Zugangsdaten</h3>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Benutzername *</label>
                <input required name="username" value={formData.username} onChange={handleChange} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all shadow-sm" placeholder="garten_profi" />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">E-Mail Adresse *</label>
                <input type="email" required name="email" value={formData.email} onChange={handleChange} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all shadow-sm" placeholder="mail@beispiel.de" />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Passwort *</label>
                <input type="password" required minLength={6} name="password" value={formData.password} onChange={handleChange} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all shadow-sm" placeholder="Mindestens 6 Zeichen" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Passwort wiederholen *</label>
                <input type="password" required minLength={6} name="passwordRepeat" value={formData.passwordRepeat} onChange={handleChange} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all shadow-sm" placeholder="Passwort bestätigen" />
              </div>

            </div>

            <div className="pt-6 border-t border-gray-100">
              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full bg-emerald-600 text-white font-bold text-lg py-4 rounded-xl hover:bg-emerald-700 hover:shadow-lg transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin"/> : 'Jetzt Kostenlos Registrieren'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
