import React, { useState } from 'react';
import { Plus, Trash2, Edit, Save, X, CornerDownRight } from 'lucide-react';
import { CategoryNode } from '../../types';

interface CategoriesTabProps {
  categories: CategoryNode[];
  onUpdateCategories: (categories: CategoryNode[]) => void;
}

export default function CategoriesTab({ categories, onUpdateCategories }: CategoriesTabProps) {
  const [newCatName, setNewCatName] = useState('');
  const [newCatParentId, setNewCatParentId] = useState<string | null>(null);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCatName.trim()) {
      const newId = 'cat-' + Date.now();
      const node: CategoryNode = {
        id: newId,
        name: newCatName.trim(),
        parentId: newCatParentId === '' ? null : newCatParentId
      };
      onUpdateCategories([...categories, node]);
      setNewCatName('');
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Kategorie "${name}" wirklich löschen? ACHTUNG: Alle Unterkategorien werden ebenfalls gelöscht.`)) {
      const deleteIds = [id];
      // simple recursive delete simulation
      let added = true;
      while (added) {
        added = false;
        categories.forEach(c => {
          if (c.parentId && deleteIds.includes(c.parentId) && !deleteIds.includes(c.id)) {
            deleteIds.push(c.id);
            added = true;
          }
        });
      }
      onUpdateCategories(categories.filter(c => !deleteIds.includes(c.id)));
    }
  };

  const startEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditValue(name);
  };

  const saveEdit = (id: string) => {
    if (editValue.trim()) {
      const newCats = categories.map(c => c.id === id ? { ...c, name: editValue.trim() } : c);
      onUpdateCategories(newCats);
    }
    setEditingId(null);
  };

  // Helper to build tree structure for rendering
  const topCategories = categories.filter(c => !c.parentId);
  
  const renderCategoryNode = (cat: CategoryNode, level: number = 0) => {
    const children = categories.filter(c => c.parentId === cat.id);
    return (
      <React.Fragment key={cat.id}>
        <li className={`flex justify-between items-center p-4 hover:bg-gray-50 transition-colors cursor-pointer border-b border-gray-100 ${level > 0 ? 'bg-gray-50/30' : ''}`} onClick={() => { if (editingId !== cat.id) startEdit(cat.id, cat.name); }}>
          {editingId === cat.id ? (
            <div className={`flex-1 flex gap-2 ${level > 0 ? 'ml-6' : ''}`} onClick={e => e.stopPropagation()}>
              <input 
                type="text" 
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(cat.id); if (e.key === 'Escape') setEditingId(null); }}
                autoFocus
                className="flex-1 border border-gray-300 rounded p-1 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
              <button onClick={() => saveEdit(cat.id)} className="text-emerald-600 hover:text-emerald-800 p-1" title="Speichern">
                <Save className="w-5 h-5" />
              </button>
              <button onClick={() => setEditingId(null)} className="text-gray-500 hover:text-gray-700 p-1" title="Abbrechen">
                <X className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                {level > 0 && <span style={{ width: level * 20 }} className="inline-block text-right"><CornerDownRight className="w-4 h-4 text-gray-400 inline" /></span>}
                <span className="font-medium text-gray-800">{cat.name}</span>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); startEdit(cat.id, cat.name); }}
                  className="text-blue-600 hover:text-blue-800 p-2 rounded-md hover:bg-blue-50 transition-colors"
                  title="Bearbeiten"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDelete(cat.id, cat.name); }}
                  className="text-red-500 hover:text-red-700 p-2 rounded-md hover:bg-red-50 transition-colors"
                  title="Löschen"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </li>
        {children.map(child => renderCategoryNode(child, level + 1))}
      </React.Fragment>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden max-w-3xl">
      <div className="p-5 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
        <h3 className="font-semibold text-gray-800 text-lg">Kategorienverwaltung</h3>
      </div>
      
      <div className="p-6">
        <form onSubmit={handleAdd} className="flex gap-3 mb-8 flex-col sm:flex-row">
          <input 
            type="text" 
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder="Neue Kategorie eingeben..."
            className="flex-1 border border-gray-300 rounded-md p-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
          />
          <select 
            value={newCatParentId || ''} 
            onChange={(e) => setNewCatParentId(e.target.value || null)}
            className="border border-gray-300 rounded-md p-2 text-sm max-w-[200px]"
          >
            <option value="">-- Als Hauptkategorie --</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button 
            type="submit" 
            disabled={!newCatName.trim()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 text-sm"
          >
            <Plus className="w-4 h-4" /> Hinzufügen
          </button>
        </form>

        <div className="border border-gray-200 rounded-md overflow-hidden">
          {categories.length === 0 ? (
             <div className="p-6 text-center text-gray-500">Keine Kategorien vorhanden.</div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {topCategories.map(c => renderCategoryNode(c, 0))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
