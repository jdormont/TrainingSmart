import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabaseClient';
import { trainingPlansService } from '../services/trainingPlansService';
import type { TrainingPlan } from '../types'; // Import from types if available there, or re-export from service if that's where it is. Assuming 'types' based on other files.

interface PlanData {
  plans: TrainingPlan[];
  isAuthenticated: boolean;
}

export const usePlanData = () => {
    const queryClient = useQueryClient(); // Keep for future use or remove if strict

    const fetchPlans = async (): Promise<PlanData> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
             return { plans: [], isAuthenticated: false };
        }

        try {
            const plans = await trainingPlansService.getPlans();
            return { plans, isAuthenticated: true };
        } catch (error) {
            console.error('Error fetching plans:', error);
            throw error;
        }
    };

    const query = useQuery({
        queryKey: ['plan-data'],
        queryFn: fetchPlans,
        staleTime: 300000, // 5 mins
    });
    
    return query;
};
