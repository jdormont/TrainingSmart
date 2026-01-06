import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Workout } from '../../types';
import WorkoutCard from './WorkoutCard';

interface DraggableWorkoutCardProps {
    workout: Workout;
    onToggleComplete?: (workoutId: string) => void;
    onStatusChange?: (workoutId: string, status: 'planned' | 'completed' | 'skipped') => void;
    onDelete?: (workoutId: string) => void;
}

export const DraggableWorkoutCard: React.FC<DraggableWorkoutCardProps> = ({
    workout,
    onToggleComplete,
    onStatusChange,
    onDelete
}) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: workout.id,
        data: { workout }, // Pass workout data for DragOverlay and event handlers
    });

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    } : undefined;

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={`w-full ${isDragging ? 'opacity-30' : ''}`} // Ghost effect
        >
            <WorkoutCard
                workout={workout}
                onToggleComplete={onToggleComplete}
                onStatusChange={onStatusChange}
                onDelete={onDelete}
                showDate={false}
                compact={true}
            />
        </div>
    );
};
