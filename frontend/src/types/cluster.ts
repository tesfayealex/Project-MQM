export interface CustomWordCluster {
  id: number;
  name: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCustomWordClusterPayload {
  name: string;
} 