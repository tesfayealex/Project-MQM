import React from 'react';
import Link from 'next/link';
import { Survey } from '@/types/survey';

interface SurveyListProps {
  surveys: Survey[];
  onDelete: (id: number) => void;
}

const SurveyList: React.FC<SurveyListProps> = ({ surveys, onDelete }) => {
  const handleDelete = (id: number) => {
    onDelete(id);
  };

  return (
    <div>
      {surveys.map((survey) => (
        <div key={survey.id} className="flex gap-2">
          <Link href={`/dashboard/surveys/${survey.id}/edit`}>Edit</Link>
          <Link href={`/dashboard/surveys/${survey.id}/analysis`}>Analysis</Link>
          <button
            className="text-red-600"
            onClick={() => handleDelete(survey.id)}
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
};

export default SurveyList; 