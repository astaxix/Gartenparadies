import React, { useState } from 'react';
import { Plus, Trash2, Edit, Save, X } from 'lucide-react';

interface CategoriesTabProps {
  categories: string[];
  onUpdateCategories: (categories: string[]) => void;
}

export default function CategoriesTab({ categories, onUpdateCategories }: CategoriesTabProps) {
  const [newCat, setNewCat] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCat.trim() && !categories.includes(newCat.trim())) {
      onUpdateCategories([...categories, newCat.trim()]);
      setNewCat('');
    }
  };

  const handleDelete = (cat: string) => {
    if (confirm(`Kategorie "${cat}" wirklich löschen?`)) {
      onUpdateCategories(categories.filter(c => c !== cat));
    }
  };

  const startEdit = (index: number, cat: string) => {
    setEditingIndex(index);
    setEditValue(cat);
  };

  const saveEdit = (index: number) => {
    if (editValue.trim() && editValue.trim() !== categories[index]) {
      const newCats = [...categories];
      newCats[index] = editValue.trim();
      onUpdateCategories(newCats);
    }
    setEditingIndex(null);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden max-w-3xl">
      <div className="p-5 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
        <h3 className="font-semibold text-gray-800 text-lg">Kategorienverwaltung</h3>
      </div>
      
      <div className="p-6">
        <form onSubmit={handleAdd} className="flex gap-3 mb-8">
          <input 
            type="text" 
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            placeholder="Neue Kategorie eingeben..."
            className="flex-1 border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
          <button 
            type="submit" 
            disabled={!newCat.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium flex items-center gap-2 transition-colors disabled:opacity-50 text-sm"
          >
            <Plus className="w-4 h-4" /> Hinzufügen
          </button>
        </form>

        <div className="border border-gray-200 rounded-md overflow-hidden">
          {categories.length === 0 ? (
             <div className="p-6 text-center text-gray-500">Keine Kategorien vorhanden.</div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {categories.map((c, i) => (
                <li key={i} className="flex justify-between items-center p-4 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => { if (editingIndex !== i) startEdit(i, c); }}>
                  {editingIndex === i ? (
                    <div className="flex-1 flex gap-2" onClick={e => e.stopPropagation()}>
                      <input 
                        type="text" 
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(i); if (e.key === 'Escape') setEditingIndex(null); }}
                        autoFocus
                        className="flex-1 border border-gray-300 rounded p-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                      <button onClick={() => saveEdit(i)} className="text-blue-600 hover:text-blue-800 p-1" title="Speichern">
                        <Save className="w-5 h-5" />
                      </button>
                      <button onClick={() => setEditingIndex(null)} className="text-gray-500 hover:text-gray-700 p-1" title="Abbrechen">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="font-medium text-gray-800">{c}</span>
                      <div className="flex gap-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); startEdit(i, c); }}
                          className="text-blue-600 hover:text-blue-800 p-2 rounded-md hover:bg-blue-50 transition-colors"
                          title="Bearbeiten"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDelete(c); }}
                          className="text-red-500 hover:text-red-700 p-2 rounded-md hover:bg-red-50 transition-colors"
                          title="Löschen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
