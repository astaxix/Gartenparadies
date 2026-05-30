import React, { useState, useEffect, useRef } from 'react';
import { Product, ProductVariation, VolumePricing, ProductDocument, CategoryNode } from '../../types';
import { Plus, Edit, Trash2, X, Save, Image as ImageIcon, UploadCloud, FileText } from 'lucide-react';

interface ArticlesTabProps {
  products: Product[];
  categories: CategoryNode[];
  onUpdateProducts: (products: Product[]) => void;
}

function LocalPriceInput({ value, onChange, placeholder }: { value: number, onChange: (v: number) => void, placeholder?: string }) {
  const [localVal, setLocalVal] = useState(value?.toString().replace('.', ',') || '');
  
  useEffect(() => {
    // Only sync if parsed value mismatches to avoid destroying mid-typing states like "0,"
    const parsedLocal = parseFloat(localVal.replace(',', '.')) || 0;
    if (parsedLocal !== value && localVal !== '' && !localVal.endsWith(',')) {
      setLocalVal(value?.toString().replace('.', ','));
    }
  }, [value]);

  return (
    <input 
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      value={localVal}
      onChange={(e) => {
        setLocalVal(e.target.value);
        const rawVal = e.target.value.replace(',', '.');
        const numVal = rawVal === '' || rawVal === '-' ? 0 : (parseFloat(rawVal) || 0);
        onChange(numVal);
      }}
      onBlur={() => {
        const rawVal = localVal.replace(',', '.');
        const numVal = rawVal === '' || rawVal === '-' ? 0 : (parseFloat(rawVal) || 0);
        setLocalVal(numVal.toString().replace('.', ','));
        onChange(numVal);
      }}
      className="w-full border border-gray-300 rounded-md p-1.5 sm:p-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
    />
  );
}

export default function ArticlesTab({ products, categories, onUpdateProducts }: ArticlesTabProps) {
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [editingVariations, setEditingVariations] = useState<ProductVariation[]>([]);
  const [editingVolumeTiers, setEditingVolumeTiers] = useState<VolumePricing[]>([]);
  const [editingDocuments, setEditingDocuments] = useState<ProductDocument[]>([]);
  const [formCategory, setFormCategory] = useState<string>('');
  const [formCategories, setFormCategories] = useState<string[]>([]);
  const [formPlannerType, setFormPlannerType] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingProduct) {
      setPreviewImage(editingProduct.imageUrl);
      setEditingVariations(editingProduct.variations || []);
      setEditingVolumeTiers(editingProduct.volumePricing || []);
      setEditingDocuments(editingProduct.documents || []);
      setFormCategory(editingProduct.category || '');
      setFormCategories(editingProduct.categories || (editingProduct.category ? [editingProduct.category].filter(Boolean) : []));
      setFormPlannerType(editingProduct.plannerType || '');
    } else if (isCreating) {
      setPreviewImage(null);
      setEditingVariations([]);
      setEditingVolumeTiers([]);
      setEditingDocuments([]);
      setFormCategory('');
      setFormCategories([]);
      setFormPlannerType('');
    } else {
      setPreviewImage(null);
      setEditingVariations([]);
      setEditingVolumeTiers([]);
      setEditingDocuments([]);
      setFormCategory('');
      setFormCategories([]);
      setFormPlannerType('');
    }
  }, [editingProduct, isCreating]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          // Scale down if needed (max 800x800)
          const MAX_SIZE = 800;
          if (width > MAX_SIZE || height > MAX_SIZE) {
            if (width > height) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            } else {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }
          canvas.width = Math.round(width);
          canvas.height = Math.round(height);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            // Compress to jpeg quality 0.7 to keep size small for Firestore 1MB limit
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            setPreviewImage(dataUrl);
          }
        };
        if (event.target?.result) {
          img.src = event.target.result as string;
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      Array.from(files).forEach((file: File, i) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            const newDoc: ProductDocument = {
              id: `doc-${Date.now()}-${i}`,
              name: file.name,
              url: event.target.result as string
            };
            setEditingDocuments(prev => [...prev, newDoc]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
    // reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    // Fallback to first selected category if not present
    const primaryCategory = formCategories[0] || (formData.get('category') as string) || '';
    
    const isPlannerCat = formCategories.some(id => id === 'Planer Artikel' || categories.find(c => c.id === id)?.name === 'Planer Artikel') || primaryCategory === 'Planer Artikel';

    const newProduct: Product = {
      id: isCreating ? `p-${Date.now()}` : editingProduct!.id,
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      shortDescription: formData.get('shortDescription') as string,
      price: parseFloat((formData.get('price') as string).replace(',', '.')) || 0,
      category: primaryCategory,
      categories: formCategories.length > 0 ? formCategories : [primaryCategory].filter(Boolean),
      imageUrl: previewImage || formData.get('imageUrl') as string || 'https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?auto=format&fit=crop&q=80&w=400&h=300',
      stock: parseInt(formData.get('stock') as string, 10) || 0,
      articleNumber: formData.get('articleNumber') as string,
      metaTitle: formData.get('metaTitle') as string,
      metaDescription: formData.get('metaDescription') as string,
      metaAdsText: formData.get('metaAdsText') as string,
      metaKeywords: formData.get('metaKeywords') as string,
      weight: parseFloat((formData.get('weight') as string).replace(',', '.')) || 0,
      deliveryStatus: formData.get('deliveryStatus') as string,
      manufacturer: formData.get('manufacturer') as string,
      minOrderQuantity: parseInt(formData.get('minOrderQuantity') as string, 10) || 1,
      taxClass: formData.get('taxClass') as string,
      isActive: formData.get('isActive') === 'on',
      variations: editingVariations,
      volumePricing: editingVolumeTiers,
      documents: editingDocuments,
      plannerType: isPlannerCat ? (formData.get('plannerType') as any || undefined) : undefined,
      plannerStations: (isPlannerCat && formData.get('plannerStations')) ? parseInt(formData.get('plannerStations') as string, 10) : undefined,
      plannerWires: (isPlannerCat && formData.get('plannerWires')) ? parseInt(formData.get('plannerWires') as string, 10) : undefined,
    };

    if (isCreating) {
      onUpdateProducts([...products, newProduct]);
    } else {
      onUpdateProducts(products.map(p => p.id === newProduct.id ? newProduct : p));
    }
    
    setEditingProduct(null);
    setIsCreating(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Artikel wirklich löschen?')) {
      onUpdateProducts(products.filter(p => p.id !== id));
    }
  };

  if (editingProduct || isCreating) {
    const p = editingProduct || { isActive: true, minOrderQuantity: 1, taxClass: 'Standardsteuersatz (National)', deliveryStatus: 'ca. 2 - 4 Tage' } as Partial<Product>;
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-lg sticky top-0 z-10">
          <h2 className="text-xl font-bold text-gray-800">{isCreating ? 'Neuen Artikel anlegen' : 'Artikel bearbeiten'}</h2>
          <div className="flex gap-3">
            <button type="button" onClick={() => { setEditingProduct(null); setIsCreating(false); }} className="px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md text-sm font-medium">
              Abbrechen
            </button>
            <button form="productForm" type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2 text-sm font-medium">
              <Save className="w-4 h-4" /> Speichern
            </button>
          </div>
        </div>

        <form id="productForm" onSubmit={handleSave} className="p-6 space-y-8">
          
          {/* Kategorien */}
          <section className="bg-gray-50/50 p-6 rounded-lg border border-gray-100">
            <h3 className="font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200 flex items-center gap-2">
              Kategorien
            </h3>
            <div className="max-w-md">
              <label className="block text-sm font-medium text-gray-700 mb-2">Zugeordnete Kategorien</label>
              <div className="bg-white border border-gray-300 rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                {categories.map(c => (
                  <div key={c.id} className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id={`cat-${c.id}`}
                      checked={formCategories.includes(c.id)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        let newCats = [...formCategories];
                        if (checked && !newCats.includes(c.id)) newCats.push(c.id);
                        if (!checked) newCats = newCats.filter(id => id !== c.id);
                        
                        setFormCategories(newCats);
                        setFormCategory(newCats[0] || '');
                        
                        if (editingProduct) {
                          setEditingProduct({
                            ...editingProduct,
                            categories: newCats,
                            category: newCats[0] || ''
                          });
                        }
                      }}
                      className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <label htmlFor={`cat-${c.id}`} className="text-sm text-gray-700">{c.name}</label>
                  </div>
                ))}
              </div>
            </div>
            
            {((editingProduct?.categories || [formCategory]).some(id => {
              const cat = categories.find(c => c.id === id);
              return cat?.name === 'Planer Artikel' || id === 'Planer Artikel';
            })) && (
              <div className="mt-6 border-t border-gray-200 pt-6">
                <h4 className="font-semibold text-gray-800 mb-4 pb-2 flex items-center gap-2">
                  Planer-Artikel Einstellungen
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Planer-Typ *</label>
                    <select 
                      name="plannerType" 
                      value={formPlannerType}
                      onChange={(e) => setFormPlannerType(e.target.value)}
                      required 
                      className="w-full border border-gray-300 rounded-md p-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    >
                      <option value="">- Typ wählen -</option>
                      
                      <optgroup label="Rohre & Schläuche">
                        <option value="pe_pipe">PE Rohr 25mm (hart)</option>
                        <option value="drip_tube">Tropfschlauch</option>
                        <option value="soft_pipe">PE-Rohr weich 16mm (Zuleitung Beet)</option>
                      </optgroup>
                      
                      <optgroup label="Regner">
                        <option value="sprinkler">Zusammengebautes Regner-Set (Standard)</option>
                        <option value="sprinkler_body">Hunter Pro-Spray PRS40 Gehäuse</option>
                        <option value="rzws">Wurzelzonen-Bewässerungssystem (RZWS)</option>
                      </optgroup>
                      
                      <optgroup label="Verbinder">
                        <option value="connector_25_16">Verbinder PE-Rohr 25mm x weich 16mm</option>
                        <option value="elbow_25_12">Klemmverschraubung Winkel 25mm x 1/2" IG</option>
                        <option value="t_piece_25_12_25">Klemmverschraubung T-Stück 25mm x 1/2" IG x 25mm</option>
                        <option value="swing_joint">Swing Joint 1/2" AG x 1/2" AG</option>
                      </optgroup>
                      
                      <optgroup label="Ventile & Boxen">
                        <option value="valve">Magnetventil</option>
                        <option value="valve_box">Verteilerbox</option>
                        <option value="assembled_box">Vormontierte Verteilerbox Komplett-Set</option>
                        <option value="pressure_reducer">Druckminderer</option>
                      </optgroup>
                      
                      <optgroup label="Steuerung">
                        <option value="controller">Steuergerät</option>
                        <option value="cable">Steuerkabel</option>
                      </optgroup>
                      
                      <optgroup label="Zubehör">
                        <option value="fitting">Standard Fitting Set</option>
                      </optgroup>
                    </select>
                  </div>
                  
                  {(formPlannerType === 'controller' || formPlannerType === 'assembled_box') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Anzahl Stationen / Kreisläufe *</label>
                      <input 
                        type="number" 
                        name="plannerStations" 
                        defaultValue={p.plannerStations} 
                        required 
                        min="1"
                        className="w-full border border-gray-300 rounded-md p-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" 
                        placeholder={formPlannerType === 'assembled_box' ? "z.B. 4" : "z.B. 6"}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {formPlannerType === 'assembled_box' 
                          ? "Die Anzahl an steuerbaren Zonen. Jedes Set enthält das Hauptventil (+1 Magnetventil). Z.B. hat eine Einheit mit 4 Stationen insgesamt 5 Magnetventile."
                          : "Das Hauptventil ist immer inkludiert. Ein 6-Stationen Gerät kann 6 Magnetventile + 1 Hauptventil steuern."}
                      </p>
                    </div>
                  )}
                  
                  {formPlannerType === 'cable' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Adern-Anzahl *</label>
                      <input 
                        type="number" 
                        name="plannerWires" 
                        defaultValue={p.plannerWires} 
                        required
                        min="2"
                        className="w-full border border-gray-300 rounded-md p-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" 
                        placeholder="z.B. 5"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Artikelstammdaten */}
          <section className="bg-gray-50/50 p-6 rounded-lg border border-gray-100">
            <h3 className="font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200 flex items-center gap-2">
              Artikelstammdaten
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              <div className="col-span-full">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" name="isActive" defaultChecked={p.isActive} className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500" />
                  <span className="text-sm font-medium text-gray-700">Artikelstatus aktiv</span>
                </label>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Artikel-Nr.</label>
                <input name="articleNumber" defaultValue={p.articleNumber} required className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Lageranzahl</label>
                <input name="stock" type="number" defaultValue={p.stock || 0} required className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Artikelgewicht (kg)</label>
                <input name="weight" type="number" step="0.01" defaultValue={p.weight} className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="z.B. 1.5" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Lieferstatus</label>
                <select name="deliveryStatus" defaultValue={p.deliveryStatus} className="w-full border border-gray-300 rounded-md p-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
                  <option value="ca. 2 - 4 Tage">ca. 2 - 4 Tage</option>
                  <option value="ca. 1 Woche">ca. 1 Woche</option>
                  <option value="Momentan nicht lieferbar">Momentan nicht lieferbar</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Artikelhersteller</label>
                <select name="manufacturer" defaultValue={p.manufacturer} className="w-full border border-gray-300 rounded-md p-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
                  <option value="">- keine -</option>
                  <option value="Eigenmarke">Eigenmarke</option>
                  <option value="Aquarium Systems">Aquarium Systems</option>
                  <option value="Tropica">Tropica</option>
                  <option value="Oase">Oase</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Mindestbestellmenge</label>
                <input name="minOrderQuantity" type="number" defaultValue={p.minOrderQuantity} className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
              </div>
            </div>
          </section>

          {/* Artikeldetails */}
          <section className="bg-gray-50/50 p-6 rounded-lg border border-gray-100">
            <h3 className="font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200 flex items-center gap-2">
              Artikeldetails & SEO
            </h3>
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Artikelname</label>
                <input name="name" defaultValue={p.name} required className="w-full border border-gray-300 rounded-md p-2 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Kurzbeschreibung</label>
                  <textarea name="shortDescription" defaultValue={p.shortDescription} rows={3} className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"></textarea>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Zusatzbegriffe für Suche (Meta Keywords)</label>
                  <textarea name="metaKeywords" defaultValue={p.metaKeywords} rows={3} className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"></textarea>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Artikelbeschreibung</label>
                <textarea name="description" defaultValue={p.description} required rows={6} className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"></textarea>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-gray-100">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Meta Title</label>
                  <input name="metaTitle" defaultValue={p.metaTitle} className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Meta Description</label>
                  <input name="metaDescription" defaultValue={p.metaDescription} className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                </div>
              </div>
            </div>
          </section>

          {/* Artikelbilder */}
          <section className="bg-gray-50/50 p-6 rounded-lg border border-gray-100">
            <h3 className="font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200 flex items-center gap-2">
              Artikelbilder
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              <div className="p-6 border-2 border-dashed border-gray-300 bg-white rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-colors text-center cursor-pointer relative group">
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleImageChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  title="Bild auswählen"
                />
                <UploadCloud className="w-10 h-10 text-gray-400 mx-auto mb-2 group-hover:text-blue-500 transition-colors" />
                <p className="text-sm font-medium text-gray-700">Bild vom Gerät hochladen</p>
                <p className="text-xs text-gray-500 mt-1">PNG, JPG, WEBP (max. 2MB)</p>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Oder Bild-URL angeben</label>
                  <input 
                    name="imageUrl" 
                    defaultValue={p.imageUrl} 
                    onChange={(e) => { if(!e.target.value.startsWith('blob:')) setPreviewImage(e.target.value) }}
                    className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" 
                    placeholder="https://..." 
                  />
                </div>
                
                <div className="bg-white p-4 border border-gray-200 rounded-xl">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Vorschau</p>
                  <div className="relative w-40 h-40 bg-gray-50 border border-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                    {previewImage ? (
                      <img src={previewImage} alt="Preview" className="w-full h-full object-contain" />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-gray-300" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Variationen */}
          <section className="bg-purple-50/50 p-6 rounded-lg border border-purple-100">
            <h3 className="font-semibold text-purple-800 mb-4 pb-2 border-b border-purple-200 flex items-center justify-between">
              <span className="flex items-center gap-2">Variationen (z.B. Größe, Farbe)</span>
              <button 
                type="button" 
                onClick={() => setEditingVariations([...editingVariations, { id: `var-${Date.now()}`, name: '', options: [] }])}
                className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded hover:bg-purple-700 transition flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Variation hinzufügen
              </button>
            </h3>
            
            <div className="space-y-6">
              {editingVariations.length === 0 ? (
                <p className="text-sm text-purple-600/70 italic text-center py-4">Keine Variationen angelegt.</p>
              ) : (
                editingVariations.map((v, vIndex) => (
                  <div key={v.id} className="bg-white p-4 rounded-md border border-purple-200">
                    <div className="flex justify-between items-center mb-3">
                      <input 
                        type="text" 
                        placeholder="Variationsname (z.B. Größe)" 
                        value={v.name}
                        onChange={(e) => {
                          const newVars = [...editingVariations];
                          newVars[vIndex] = { ...v, name: e.target.value };
                          setEditingVariations(newVars);
                        }}
                        className="font-medium text-sm border-b border-gray-300 focus:border-purple-500 outline-none pb-1 bg-transparent w-full max-w-[200px]"
                      />
                      <button 
                        type="button"
                        onClick={() => setEditingVariations(editingVariations.filter((_, i) => i !== vIndex))}
                        className="text-red-500 hover:text-red-700"
                        title="Variation löschen"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="space-y-4 mt-4 sm:ml-4 border-l-2 border-purple-100 pl-4">
                      {v.options.map((opt, oIndex) => (
                        <div key={oIndex} className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3">
                          <input 
                            type="text" 
                            placeholder="Optionsname (z.B. 10 Liter)"
                            value={opt.name}
                            onChange={(e) => {
                              const newVars = [...editingVariations];
                              const newOpts = [...v.options];
                              newOpts[oIndex] = { ...opt, name: e.target.value };
                              newVars[vIndex] = { ...v, options: newOpts };
                              setEditingVariations(newVars);
                            }}
                            className="text-sm border border-gray-300 rounded px-2 py-1.5 flex-1 min-w-[150px] outline-none focus:border-purple-500"
                          />
                          <div className="flex items-center gap-1 w-[140px] shrink-0">
                            <span className="text-xs text-gray-500">+</span>
                            <LocalPriceInput 
                              value={opt.priceDiff}
                              placeholder="0,00"
                              onChange={(numVal) => {
                                const newVars = [...editingVariations];
                                const newOpts = [...v.options];
                                newOpts[oIndex] = { ...opt, priceDiff: numVal };
                                newVars[vIndex] = { ...v, options: newOpts };
                                setEditingVariations(newVars);
                              }}
                            />
                            <span className="text-xs text-gray-500">€</span>
                          </div>
                          <button 
                            type="button"
                            onClick={() => {
                              const newVars = [...editingVariations];
                              const newOpts = v.options.filter((_, i) => i !== oIndex);
                              newVars[vIndex] = { ...v, options: newOpts };
                              setEditingVariations(newVars);
                            }}
                            className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50"
                            title="Option löschen"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <button 
                        type="button"
                        onClick={() => {
                          const newVars = [...editingVariations];
                          newVars[vIndex] = { ...v, options: [...v.options, { name: '', priceDiff: 0 }] };
                          setEditingVariations(newVars);
                        }}
                        className="text-xs text-purple-600 hover:text-purple-800 mt-2 flex items-center gap-1 font-medium"
                      >
                        <Plus className="w-3 h-3" /> Option hinzufügen
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Preisoptionen */}
          <section className="bg-emerald-50/50 p-6 rounded-lg border border-emerald-100">
            <h3 className="font-semibold text-emerald-800 mb-4 pb-2 border-b border-emerald-200 flex items-center gap-2">
              Preisoptionen
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <div>
                <label className="block text-xs font-semibold text-emerald-800 uppercase tracking-wider mb-1">Artikelpreis (€)</label>
                <input name="price" type="text" inputMode="decimal" defaultValue={p.price?.toString().replace('.', ',')} required className="w-full border border-emerald-200 rounded-md p-2 text-lg font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none shadow-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-emerald-800 uppercase tracking-wider mb-1">Steuerklasse</label>
                <select name="taxClass" defaultValue={p.taxClass} className="w-full border border-emerald-200 rounded-md p-2.5 bg-white text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none">
                  <option value="Standardsteuersatz (National)">Standardsteuersatz (19%)</option>
                  <option value="Ermäßigter Steuersatz (National)">Ermäßigter Steuersatz (7%)</option>
                  <option value="Steuerfrei">Steuerfrei</option>
                </select>
              </div>
            </div>

            <div className="mt-8 border-t border-emerald-200 pt-6">
              <h4 className="font-semibold text-emerald-800 mb-4 flex items-center justify-between">
                <span>Staffelpreise</span>
                <button 
                  type="button" 
                  onClick={() => setEditingVolumeTiers([...editingVolumeTiers, { quantity: 2, price: 0 }])}
                  className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded hover:bg-emerald-700 transition flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Hinzufügen
                </button>
              </h4>
              
              <div className="space-y-3">
                {editingVolumeTiers.length === 0 ? (
                  <p className="text-sm text-emerald-600/70 italic text-center py-2">Keine Staffelpreise definiert.</p>
                ) : (
                  editingVolumeTiers.map((tier, index) => (
                    <div key={index} className="flex items-center gap-4 bg-white p-3 rounded-lg border border-emerald-100 shadow-sm">
                      <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                        <span className="text-sm text-gray-500 whitespace-nowrap">ab Stückzahl:</span>
                        <input 
                          type="number"
                          min="2"
                          value={tier.quantity}
                          onChange={(e) => {
                            const newTiers = [...editingVolumeTiers];
                            newTiers[index] = { ...tier, quantity: parseInt(e.target.value, 10) || 2 };
                            setEditingVolumeTiers(newTiers);
                          }}
                          className="w-full sm:w-24 border border-gray-300 rounded-md p-1.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                      <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                        <span className="text-sm text-gray-500 whitespace-nowrap">
                          {editingVariations.length > 0 ? 'Rabatt:' : 'Preis/Stück:'}
                        </span>
                        <div className="flex items-center gap-1 w-full">
                          <LocalPriceInput 
                            value={editingVariations.length > 0 ? (tier.discountPercentage ?? 0) : (tier.price ?? 0)}
                            onChange={(numVal) => {
                              const newTiers = [...editingVolumeTiers];
                              if (editingVariations.length > 0) {
                                newTiers[index] = { ...tier, discountPercentage: numVal };
                              } else {
                                newTiers[index] = { ...tier, price: numVal };
                              }
                              setEditingVolumeTiers(newTiers);
                            }}
                          />
                          <span className="text-gray-500 text-sm">{editingVariations.length > 0 ? '%' : '€'}</span>
                        </div>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setEditingVolumeTiers(editingVolumeTiers.filter((_, i) => i !== index))}
                        className="text-red-400 hover:text-red-600 p-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          {/* Dokumente */}
          <section className="bg-blue-50/50 p-6 rounded-lg border border-blue-100">
            <h3 className="font-semibold text-blue-800 mb-4 pb-2 border-b border-blue-200 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" /> Dokumente
            </h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-white p-4 rounded border border-blue-200 border-dashed">
                <div>
                   <p className="text-sm font-medium text-gray-700">Dokumente hinzufügen</p>
                   <p className="text-xs text-gray-500 mt-1">Laden Sie PDF, DOCX etc. hoch, um sie beim Artikel im Shop anzuzeigen.</p>
                </div>
                <div>
                  <input 
                    type="file" 
                    id="documentUpload" 
                    className="hidden" 
                    ref={fileInputRef} 
                    onChange={handleDocumentChange} 
                    multiple 
                  />
                  <label htmlFor="documentUpload" className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2 text-sm font-medium transition-colors">
                    <UploadCloud className="w-4 h-4" /> Hochladen
                  </label>
                </div>
              </div>
              
              {editingDocuments.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
                  <ul className="divide-y divide-gray-100">
                    {editingDocuments.map((doc, index) => (
                      <li key={doc.id} className="p-3 flex justify-between items-center hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <FileText className="w-5 h-5 text-gray-400 shrink-0" />
                          <span className="text-sm font-medium text-gray-700 truncate">{doc.name}</span>
                        </div>
                        <button 
                          type="button"
                          onClick={() => setEditingDocuments(editingDocuments.filter((_, i) => i !== index))}
                          title="Dokument entfernen"
                          className="text-red-500 hover:text-red-700 p-1.5 rounded hover:bg-red-50 transition-colors shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
          
        </form>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
        <h3 className="font-semibold text-gray-800 text-lg">Artikelverwaltung</h3>
        <button 
          onClick={() => setIsCreating(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" /> Neuer Artikel
        </button>
      </div>
      
      {products.length === 0 ? (
        <div className="p-10 text-center text-gray-500">
          <ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p>Keine Artikel vorhanden.</p>
          <p className="text-sm mt-1">Legen Sie über den Button "Neuer Artikel" einen ersten Artikel an.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-white text-gray-600 border-b border-gray-200">
              <tr>
                <th className="px-3 md:px-5 py-4 font-medium w-16">Bild</th>
                <th className="px-3 md:px-5 py-4 font-medium hidden sm:table-cell">Art.-Nr.</th>
                <th className="px-3 md:px-5 py-4 font-medium w-1/3 md:w-auto">Name</th>
                <th className="px-3 md:px-5 py-4 font-medium hidden md:table-cell">Status</th>
                <th className="px-3 md:px-5 py-4 font-medium hidden lg:table-cell">Kategorie</th>
                <th className="px-3 md:px-5 py-4 font-medium text-right">Preis</th>
                <th className="px-3 md:px-5 py-4 font-medium text-right hidden sm:table-cell">Bestand</th>
                <th className="px-3 md:px-5 py-4 font-medium text-center">Aktion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {products.map(p => (
                <tr key={p.id} onClick={() => setEditingProduct(p)} className="hover:bg-blue-50/50 transition-colors cursor-pointer">
                  <td className="px-3 md:px-5 py-3">
                    <div className="w-10 h-10 rounded overflow-hidden border border-gray-200 bg-white">
                      <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                  </td>
                  <td className="px-3 md:px-5 py-3 font-mono text-xs hidden sm:table-cell">{p.articleNumber}</td>
                  <td className="px-3 md:px-5 py-3 font-medium text-gray-900 whitespace-normal min-w-[120px]">
                    <div className="line-clamp-2">{p.name}</div>
                    <div className="text-xs text-gray-400 font-normal sm:hidden mt-1">{p.articleNumber}</div>
                  </td>
                  <td className="px-3 md:px-5 py-3 hidden md:table-cell">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${p.isActive !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${p.isActive !== false ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                      {p.isActive !== false ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </td>
                  <td className="px-3 md:px-5 py-3 hidden lg:table-cell">
                    <div className="flex flex-col gap-1 items-start">
                      {(p.categories || [p.category].filter(Boolean)).map(catId => {
                        const cat = categories.find(c => c.id === catId);
                        return <span key={catId} className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs truncate max-w-[150px] block" title={cat?.name || catId}>{cat?.name || catId}</span>;
                      })}
                    </div>
                  </td>
                  <td className="px-3 md:px-5 py-3 text-right font-medium">{p.price.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</td>
                  <td className="px-3 md:px-5 py-3 text-right hidden sm:table-cell">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${p.stock > 10 ? 'bg-green-100 text-green-800' : p.stock > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                      {p.stock}
                    </span>
                  </td>
                  <td className="px-3 md:px-5 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-2">
                       <button onClick={() => setEditingProduct(p)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-colors" title="Bearbeiten">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(p.id)} className="p-1.5 text-red-600 hover:bg-red-100 rounded transition-colors" title="Löschen">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
