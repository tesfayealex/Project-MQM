import React from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { z } from 'zod';

// Define the schema (must match the parent form's schema)
const questionSchema = z.object({
  id: z.string().optional(),
  order: z.number(),
  type: z.enum(['nps', 'free_text']),
  questions: z.record(z.string(), z.string()),
  language: z.string().optional(),
  is_required: z.boolean().default(true),
  placeholder: z.string().optional(),
  placeholders: z.record(z.string(), z.string()).optional(),
});

type QuestionFormValues = {
  questions: z.infer<typeof questionSchema>[];
};

export default function QuestionForm({ languages }: { languages: string[] }) {
  const { control, register, getValues, setValue, watch, formState } = useFormContext<QuestionFormValues>();
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "questions"
  });

  // Log question validation state
  React.useEffect(() => {
    console.log('QuestionForm validation state:', {
      fields: fields,
      errors: formState.errors.questions,
      isValid: !formState.errors.questions
    });
  }, [fields, formState.errors.questions]);

  // Create a new question with all required fields
  const createNewQuestion = () => {
    const newQuestion = {
      order: fields.length,
      type: 'nps' as const,
      questions: languages.reduce((obj, lang) => ({...obj, [lang]: ''}), {}),
      is_required: true,
      placeholders: languages.reduce((obj, lang) => ({...obj, [lang]: ''}), {})
    };
    console.log('Creating new question:', newQuestion);
    return newQuestion;
  };

  // Helper to add a new question
  const addQuestion = () => {
    const newQuestion = createNewQuestion();
    console.log('Adding new question:', newQuestion);
    append(newQuestion);
  };

  // Log validation errors for debugging
  React.useEffect(() => {
    if (formState.errors.questions) {
      console.log('Question validation details:', {
        errors: formState.errors.questions,
        currentQuestions: getValues('questions'),
        languages: languages
      });
    }
  }, [formState.errors.questions, languages]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Survey Questions</h3>
        <Button 
          type="button" 
          onClick={addQuestion}
          variant="outline"
          size="sm"
        >
          <PlusIcon className="w-4 h-4 mr-2" />
          Add Question
        </Button>
      </div>

      {fields.length === 0 ? (
        <div className="py-4 text-center text-gray-500">
          No questions yet. Add your first question to get started.
        </div>
      ) : (
        fields.map((field, index) => (
          <Card key={field.id} className="relative">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-base">
                  Question {index + 1}
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => index > 0 && move(index, index - 1)}
                    disabled={index === 0}
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => index < fields.length - 1 && move(index, index + 1)}
                    disabled={index === fields.length - 1}
                  >
                    ↓
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700"
                    onClick={() => remove(index)}
                  >
                    <TrashIcon className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`questions.${index}.type`}>Question Type</Label>
                  <Select
                    value={watch(`questions.${index}.type`)}
                    onValueChange={(value) => setValue(`questions.${index}.type`, value as 'nps' | 'free_text')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select question type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nps">Net Promoter Score (1-10)</SelectItem>
                      <SelectItem value="free_text">Free Text</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2 pt-6">
                  <Switch
                    id={`questions.${index}.is_required`}
                    checked={watch(`questions.${index}.is_required`)}
                    onCheckedChange={(checked) => setValue(`questions.${index}.is_required`, checked)}
                  />
                  <Label htmlFor={`questions.${index}.is_required`}>Required question</Label>
                </div>
              </div>

              {/* Question text for each language */}
              {languages.map(lang => (
                <div key={`${field.id}-${lang}`} className="space-y-2">
                  <Label htmlFor={`questions.${index}.questions.${lang}`}>
                    Question Text - {lang.toUpperCase()}
                  </Label>
                  <Textarea
                    id={`questions.${index}.questions.${lang}`}
                    {...register(`questions.${index}.questions.${lang}`, {
                      required: true
                    })}
                    placeholder={`Enter question in ${lang.toUpperCase()}`}
                    className="min-h-[80px]"
                  />
                </div>
              ))}

              {/* Placeholder for each language */}
              {languages.map(lang => (
                <div key={`${field.id}-${lang}-placeholder`} className="space-y-2">
                  <Label htmlFor={`questions.${index}.placeholders.${lang}`}>
                    Placeholder - {lang.toUpperCase()}
                  </Label>
                  <Textarea
                    id={`questions.${index}.placeholders.${lang}`}
                    {...register(`questions.${index}.placeholders.${lang}`)}
                    placeholder={`Enter placeholder in ${lang.toUpperCase()}`}
                    className="min-h-[80px]"
                  />
                </div>
              ))}

              {/* Hidden fields */}
              <input 
                type="hidden" 
                {...register(`questions.${index}.order`)} 
                value={index} 
              />
            </CardContent>
          </Card>
        ))
      )}

      {fields.length > 0 && (
        <div className="flex justify-center mt-4">
          <Button 
            type="button" 
            onClick={addQuestion}
            variant="outline"
          >
            <PlusIcon className="w-4 h-4 mr-2" />
            Add Another Question
          </Button>
        </div>
      )}
    </div>
  );
}