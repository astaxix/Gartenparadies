import React, { useState, useRef } from 'react';
import { Database, Download, Upload, CheckCircle, AlertTriangle, Play, RefreshCw, FileJson } from 'lucide-react';
import { Product, CategoryNode } from '../../types';
import { db } from '../../lib/firebase';
import { collection, doc, getDocs, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';

interface BackupTabProps {
  products: Product[];
  categories: CategoryNode[];
  onUpdateProducts: (products: Product[]) => void;
  onUpdateCategories: (categories: CategoryNode[]) => void;
}

export default function BackupTab({ products, categories, onUpdateProducts, onUpdateCategories }: BackupTabProps) {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getFirebaseMode = () => {
    const isCustom = !!(import.meta as any).env.VITE_FIREBASE_PROJECT_ID;
    return isCustom ? 'Eigene produktive Firebase (Vercel / Prod)' : 'AI Studio Sandbox Datenbank';
  };

  const getFirebaseProjectId = () => {
    return (import.meta as any).env.VITE_FIREBASE_PROJECT_ID || 'gen-lang-client-... (Sandbox)';
  };

  const handleExport = async () => {
    setExporting(true);
    setStatusMessage({ type: 'info', text: 'Sichere Daten werden erstellt...' });
    try {
      // Fetch all plans to include them as backup
      let plansBackup: any[] = [];
      try {
        const plansSnap = await getDocs(collection(db, 'plans'));
        plansBackup = plansSnap.docs.map(doc => doc.data());
      } catch (err) {
        console.warn('Could not export plans from Firestore:', err);
      }

      const backupObj = {
        version: "1.0",
        timestamp: new Date().toISOString(),
        products: products,
        categories: categories,
        plansCount: plansBackup.length,
        plans: plansBackup,
        environment: getFirebaseMode()
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupObj, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `gartenparadies_backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      setStatusMessage({ type: 'success', text: 'Daten erfolgreich in JSON-Datei exportiert!' });
    } catch (error: any) {
      console.error(error);
      setStatusMessage({ type: 'error', text: 'Fehler beim Daten-Export: ' + error.message });
    } finally {
      setExporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!json.products || !Array.isArray(json.products)) {
          throw new Error("Ungültiges Backup-Format. 'products' Array fehlt.");
        }
        setParsedData(json);
        setStatusMessage({ type: 'info', text: 'Backup-Datei gelesen. Bereit zum Importieren.' });
      } catch (err: any) {
        setParsedData(null);
        setSelectedFile(null);
        setStatusMessage({ type: 'error', text: 'Fehler beim Lesen der Datei: ' + err.message });
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!parsedData) return;
    setImporting(true);
    setStatusMessage({ type: 'info', text: 'Importiere Daten und überschreibe Firestore-Collections...' });

    try {
      // 1. Sync Products to Firestore and App
      const importedProducts = parsedData.products as Product[];
      await onUpdateProducts(importedProducts);

      // 2. Sync Categories to Firestore and App
      const importedCategories = (parsedData.categories || []) as CategoryNode[];
      await onUpdateCategories(importedCategories);

      // 3. Sync Plans if available in backup
      if (parsedData.plans && Array.isArray(parsedData.plans)) {
        setStatusMessage({ type: 'info', text: 'Importiere Pläne in die Cloud...' });
        const plans = parsedData.plans;
        const chunkSize = 100;
        for (let i = 0; i < plans.length; i += chunkSize) {
          const chunk = plans.slice(i, i + chunkSize);
          const batch = writeBatch(db);
          let count = 0;
          for (const plan of chunk) {
            if (plan.id) {
              batch.set(doc(db, 'plans', plan.id), plan);
              count++;
            }
          }
          if (count > 0) {
            await batch.commit();
          }
        }
      }

      setStatusMessage({
        type: 'success',
        text: `Backup erfolgreich eingespielt! ${importedProducts.length} Artikel, ${importedCategories.length} Kategorien und ${parsedData.plans?.length || 0} Pläne wurden synchronisiert.`
      });
      setParsedData(null);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error: any) {
      console.error(error);
      setStatusMessage({ type: 'error', text: 'Fehler beim Einspielen des Backups: ' + error.message });
    } finally {
      setImporting(false);
    }
  };

  const handleSeedDefaults = async () => {
    if (confirm('Standard-Bewässerungsartikel aus dem System zur Datenbank hinzufügen? Dies füllt leere Datenbanken auf.')) {
      setImporting(true);
      setStatusMessage({ type: 'info', text: 'Standard-Artikel werden in die Cloud-Datenbank geschrieben...' });
      try {
        // We load default seed products
        const { plannerProducts } = await import('../../data');
        await onUpdateProducts(plannerProducts);
        
        // Setup initial default categories
        const defaultCats: CategoryNode[] = [
          { id: 'cat-1', name: 'Pflanzen', parentId: null },
          { id: 'cat-2', name: 'Bodengrund', parentId: null },
          { id: 'cat-3', name: 'Technik', parentId: null },
          { id: 'cat-4', name: 'Planer Artikel', parentId: null }
        ];
        await onUpdateCategories(defaultCats);

        setStatusMessage({ type: 'success', text: 'Standard-Daten erfolgreich in die Cloud-Datenbank geladen!' });
      } catch (err: any) {
        console.error(err);
        setStatusMessage({ type: 'error', text: 'Fehler beim Seeding: ' + err.message });
      } finally {
        setImporting(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 mb-2">
          <Database className="w-5 h-5 text-blue-600" /> Datenpflege, Deployment & Cloud-Backup
        </h2>
        <p className="text-gray-600 text-sm">
          Hier verwaltest du die Datenbank-Inhalte deines Gartenparadies-Shops.
          Sämtliche Artikel, Kategorien, Pläne und Bestellungen liegen unabhängig von deinen Code-Deployments (Vercel) sicher in der Firestore-Cloud-Datenbank.
          Nutze diese Tools, um deine erstellten Shopdaten lokal zu sichern, zu übertragen oder eine leere Datenbank initial aufzusetzen.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Environment Info */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 space-y-4">
          <h3 className="font-bold text-gray-800 text-md border-b pb-2">Verbindungs-Status</h3>
          <div className="space-y-3 text-xs">
            <div>
              <span className="block text-gray-400 font-medium font-mono uppercase">Datenbank-Modus</span>
              <span className="font-semibold text-gray-850 bg-gray-100 px-2 py-1 rounded inline-block mt-0.5">{getFirebaseMode()}</span>
            </div>
            <div>
              <span className="block text-gray-400 font-medium font-mono uppercase">Firebase Project ID</span>
              <span className="font-mono text-gray-700 bg-gray-50 border p-1 rounded block truncate mt-0.5">{getFirebaseProjectId()}</span>
            </div>
            <div>
              <span className="block text-gray-400 font-medium font-mono uppercase">Aktive Artikel im Speicher</span>
              <span className="text-lg font-bold text-gray-900">{products.length}</span>
            </div>
            <div>
              <span className="block text-gray-400 font-medium font-mono uppercase">Aktive Kategorien</span>
              <span className="text-lg font-bold text-gray-900">{categories.length}</span>
            </div>
          </div>
          <div className="bg-blue-50/50 p-3 rounded-md border border-blue-100 text-xs text-blue-800">
            <p className="leading-relaxed">
              <strong>Info:</strong> Wenn du die App auf Vercel deployst, kannst du eigene Firebase-Credentials in den Vercel <strong>Environment Variables</strong> eintragen (siehe `.env.example`).
              Andernfalls wird das verknüpfte Sandbox-Projekt verwendet.
            </p>
          </div>
        </div>

        {/* Export Card */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-gray-800 text-md flex items-center gap-2 border-b pb-2 mb-4">
              <Download className="w-4 h-4 text-emerald-600" /> 1. Backups erstellen (Sichern)
            </h3>
            <p className="text-gray-600 text-xs leading-relaxed mb-4">
              Lade deine kompletten Artikeldaten, Kategorien und die in der Cloud gespeicherten Pläne als JSON-Datei herunter. 
              Ideal zur lokalen Archivierung oder zum Transferieren der Daten auf ein anderes Firebase-Projekt (z.B. von Dev auf Produktion).
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-lg text-xs transition duration-200 cursor-pointer select-none"
          >
            {exporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileJson className="w-4 h-4" />}
            Backup (JSON) jetzt herunterladen
          </button>
        </div>

        {/* Import Card */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-gray-800 text-md flex items-center gap-2 border-b pb-2 mb-4">
              <Upload className="w-4 h-4 text-blue-600" /> 2. Backups einspielen (Import)
            </h3>
            <p className="text-gray-600 text-xs leading-relaxed mb-4">
              Spiele eine zuvor exportierte JSON-Backup-Datei ein. 
              Alle enthaltenen Artikel, Kategorien und Pläne werden direkt in dein aktuelles Firebase-Projekt hochgeladen und überschrieben.
            </p>
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-3 text-center mb-4 bg-gray-50/50">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
                id="file-backup-upload"
              />
              <label htmlFor="file-backup-upload" className="cursor-pointer flex flex-col items-center">
                <Upload className="w-6 h-6 text-gray-400 mb-1" />
                <span className="text-[11px] font-semibold text-blue-600 hover:text-blue-800">Sicherungsdatei (.json) wählen</span>
                {selectedFile && (
                  <span className="text-[10px] text-emerald-600 font-medium truncate max-w-full mt-1">✓ {selectedFile.name}</span>
                )}
              </label>
            </div>
          </div>
          <button
            onClick={handleImport}
            disabled={!parsedData || importing}
            className={`w-full flex items-center justify-center gap-2 font-semibold py-2.5 px-4 rounded-lg text-xs transition duration-200 select-none ${(!parsedData || importing) ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'}`}
          >
            {importing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Backup einspielen & synchronisieren
          </button>
        </div>

      </div>

      {/* Notification Area */}
      {statusMessage && (
        <div className={`p-4 rounded-lg border text-sm flex gap-3 items-start ${
          statusMessage.type === 'success' ? 'bg-green-50 text-green-800 border-green-200' : 
          statusMessage.type === 'error' ? 'bg-red-50 text-red-800 border-red-200' : 'bg-blue-50 text-blue-800 border-blue-200'
        }`}>
          {statusMessage.type === 'success' && <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />}
          {statusMessage.type === 'error' && <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />}
          {statusMessage.type === 'info' && <RefreshCw className="w-5 h-5 text-blue-500 shrink-0 mt-0.5 animate-spin" />}
          <p className="font-medium text-xs font-sans leading-relaxed">{statusMessage.text}</p>
        </div>
      )}

      {/* Database Seeding Utility */}
      <div className="bg-amber-50 rounded-xl p-5 border border-amber-200 space-y-3">
        <h4 className="font-extrabold text-amber-900 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600" /> Datenbank-Initialisierung (Seeding)
        </h4>
        <p className="text-amber-800 text-xs leading-relaxed">
          Sollte deine Cloud-Datenbank (durch ein neues Firebase-Projekt, Vercel-Zuweisung oder manuelle Löschung) komplett leer sein, kannst du mit dem folgenden Tool die Standard-Düsen, Rohre, Kabel und Verteilerboxen wiederherstellen. Dadurch wird der interaktive Bewässerungsplaner voll funktionsfähig.
        </p>
        <button
          onClick={handleSeedDefaults}
          disabled={importing}
          className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white font-bold py-2 px-4 rounded-lg text-xs transition-colors select-none cursor-pointer"
        >
          <Play className="w-3.5 h-3.5" />
          Standard Bewässerungs-Artikel seeden
        </button>
      </div>
    </div>
  );
}
