import { useQuery } from '@tanstack/react-query';
import api from '../api';

export function useStudents() {
  return useQuery({
    queryKey: ['students'],
    queryFn: async () => {
      const response = await api.get('/api/students/');
      return response.data.results || response.data;
    },
    staleTime: 60000, // 1 minute
  });
}
