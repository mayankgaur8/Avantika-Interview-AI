export interface AssignmentQuestion {
  question: string;
  marks: number;
  answerGuideline: string;
}

export interface AssignmentData {
  title: string;
  instructions: string;
  questions: AssignmentQuestion[];
}
