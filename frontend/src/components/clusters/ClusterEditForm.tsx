import React, { useState, useEffect } from 'react';
import { CustomWordCluster } from '@/types/cluster';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { updateCustomCluster, addClusterKeywords, removeClusterKeyword } from '@/lib/services/cluster-service';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ClusterEditFormProps {
  cluster: CustomWordCluster | null;
  isOpen: boolean;
  onClose: () => void;
  onClusterUpdated: (cluster: CustomWordCluster) => void;
}

const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'de', name: 'German' },
  { code: 'fr', name: 'French' },
  { code: 'es', name: 'Spanish' },
];

export default function ClusterEditForm({ 
  cluster, 
  isOpen, 
  onClose, 
  onClusterUpdated 
}: ClusterEditFormProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('en');
  const [currentKeywordLang, setCurrentKeywordLang] = useState('default');
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    names: {[key: string]: string};
    descriptions: {[key: string]: string};
    multilingual_keywords: {[key: string]: string[]};
    keywords: string[];
    keyword: string;
  }>({
    name: '',
    description: '',
    names: {},
    descriptions: {},
    multilingual_keywords: {},
    keywords: [],
    keyword: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  // Load cluster data when opened
  useEffect(() => {
    if (cluster) {
      // Set form data with all available cluster data
      setFormData({
        name: cluster.name || '',
        description: cluster.description || '',
        names: cluster.names || {},
        descriptions: cluster.descriptions || {},
        multilingual_keywords: cluster.multilingual_keywords || {},
        keywords: cluster.keywords || [],
        keyword: '',
      });
    }
  }, [cluster]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLanguageInputChange = (field: 'names' | 'descriptions', lang: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: {
        ...prev[field],
        [lang]: value
      }
    }));
  };

  const handleSave = async () => {
    if (!cluster) return;
    
    try {
      setIsSaving(true);
      
      const payload = {
        name: formData.name,
        description: formData.description,
        names: formData.names,
        descriptions: formData.descriptions,
        keywords: formData.keywords,
        multilingual_keywords: formData.multilingual_keywords,
      };
      
      const updatedCluster = await updateCustomCluster(cluster.id, payload);
      onClusterUpdated(updatedCluster);
      
      toast({
        title: "Success",
        description: "Cluster updated successfully",
      });
      
      onClose();
    } catch (error) {
      console.error('Error updating cluster:', error);
      toast({
        title: "Error",
        description: "Failed to update cluster",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddKeyword = async () => {
    if (!cluster || !formData.keyword.trim()) return;
    
    try {
      setIsSaving(true);
      const keyword = formData.keyword.trim();
      const language = currentKeywordLang === 'default' ? null : currentKeywordLang;
      
      // Add to the UI state first for better UX
      if (language) {
        // Add to language-specific keywords
        setFormData(prev => ({
          ...prev,
          multilingual_keywords: {
            ...prev.multilingual_keywords,
            [language]: [...(prev.multilingual_keywords[language] || []), keyword]
          },
          keyword: '',
        }));
      } else {
        // Add to default keywords
        setFormData(prev => ({
          ...prev,
          keywords: [...prev.keywords, keyword],
          keyword: '',
        }));
      }
      
      // Then send to server
      const updatedCluster = await addClusterKeywords(cluster.id, [keyword], language || undefined);
      onClusterUpdated(updatedCluster);
      
    } catch (error) {
      console.error('Error adding keyword:', error);
      toast({
        title: "Error",
        description: "Failed to add keyword",
        variant: "destructive",
      });
      
      // Revert the UI state if there was an error
      if (cluster) {
        setFormData(prev => ({
          ...prev,
          keywords: cluster.keywords || [],
          multilingual_keywords: cluster.multilingual_keywords || {},
        }));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveKeyword = async (keyword: string, language?: string) => {
    if (!cluster) return;
    
    try {
      setIsSaving(true);
      
      // Update UI state first
      if (language) {
        // Remove from language-specific keywords
        setFormData(prev => ({
          ...prev,
          multilingual_keywords: {
            ...prev.multilingual_keywords,
            [language]: (prev.multilingual_keywords[language] || []).filter(k => k !== keyword)
          }
        }));
      } else {
        // Remove from default keywords
        setFormData(prev => ({
          ...prev,
          keywords: prev.keywords.filter(k => k !== keyword)
        }));
      }
      
      // Then send to server
      const updatedCluster = await removeClusterKeyword(cluster.id, keyword, language);
      onClusterUpdated(updatedCluster);
      
    } catch (error) {
      console.error('Error removing keyword:', error);
      toast({
        title: "Error",
        description: "Failed to remove keyword",
        variant: "destructive",
      });
      
      // Revert UI state if there was an error
      if (cluster) {
        setFormData(prev => ({
          ...prev,
          keywords: cluster.keywords || [],
          multilingual_keywords: cluster.multilingual_keywords || {},
        }));
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (!cluster) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Cluster: {cluster.name}</DialogTitle>
          <DialogDescription>
            Edit cluster details in multiple languages
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <TabsTrigger key={lang.code} value={lang.code}>{lang.name}</TabsTrigger>
              ))}
            </TabsList>
            
            {SUPPORTED_LANGUAGES.map((lang) => (
              <TabsContent key={lang.code} value={lang.code} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor={`name-${lang.code}`}>{lang.name} Name</Label>
                  <Input
                    id={`name-${lang.code}`}
                    value={lang.code === 'en' ? formData.name : (formData.names[lang.code] || '')}
                    onChange={(e) => {
                      if (lang.code === 'en') {
                        handleInputChange('name', e.target.value);
                      } else {
                        handleLanguageInputChange('names', lang.code, e.target.value);
                      }
                    }}
                    placeholder={lang.code === 'en' ? "Cluster name" : formData.name}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor={`description-${lang.code}`}>{lang.name} Description</Label>
                  <Textarea
                    id={`description-${lang.code}`}
                    value={lang.code === 'en' ? formData.description : (formData.descriptions[lang.code] || '')}
                    onChange={(e) => {
                      if (lang.code === 'en') {
                        handleInputChange('description', e.target.value);
                      } else {
                        handleLanguageInputChange('descriptions', lang.code, e.target.value);
                      }
                    }}
                    placeholder={lang.code === 'en' ? "Cluster description" : formData.description}
                    rows={3}
                  />
                </div>
              </TabsContent>
            ))}
          </Tabs>

          {/* Keywords section - separate from the language tabs */}
          <div className="space-y-4 mt-8 pt-6 border-t">
            <div className="flex items-end justify-between">
              <h3 className="text-lg font-medium">Keywords</h3>
              <Select 
                value={currentKeywordLang} 
                onValueChange={setCurrentKeywordLang}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default (no language)</SelectItem>
                  {SUPPORTED_LANGUAGES.map(lang => (
                    <SelectItem key={lang.code} value={lang.code}>{lang.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 mb-4">
              <Input
                value={formData.keyword}
                onChange={(e) => handleInputChange('keyword', e.target.value)}
                placeholder={`Add keyword ${currentKeywordLang !== 'default' ? `in ${SUPPORTED_LANGUAGES.find(l => l.code === currentKeywordLang)?.name || ''}` : ''}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddKeyword();
                  }
                }}
              />
              <Button 
                type="button" 
                size="sm" 
                onClick={handleAddKeyword}
                disabled={!formData.keyword.trim()}
              >
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>

            {/* Default keywords */}
            {formData.keywords && formData.keywords.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium mb-2">Default Keywords</h4>
                <div className="flex flex-wrap gap-2">
                  {formData.keywords.map((keyword, index) => (
                    <Badge key={index} variant="secondary" className="gap-1">
                      {keyword}
                      <button 
                        onClick={() => handleRemoveKeyword(keyword)}
                        className="ml-1 rounded-full hover:bg-gray-200 p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Language-specific keywords */}
            {Object.keys(formData.multilingual_keywords || {}).map(langCode => (
              <div key={langCode} className="mb-4">
                <h4 className="text-sm font-medium mb-2">
                  {SUPPORTED_LANGUAGES.find(l => l.code === langCode)?.name || langCode.toUpperCase()} Keywords
                </h4>
                <div className="flex flex-wrap gap-2">
                  {(formData.multilingual_keywords[langCode] || []).map((keyword, index) => (
                    <Badge key={index} variant="secondary" className="gap-1">
                      {keyword}
                      <button 
                        onClick={() => handleRemoveKeyword(keyword, langCode)}
                        className="ml-1 rounded-full hover:bg-gray-200 p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            ))}

            {formData.keywords.length === 0 && Object.keys(formData.multilingual_keywords || {}).length === 0 && (
              <div className="text-sm text-gray-500">No keywords added yet</div>
            )}
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 