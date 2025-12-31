import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { format } from 'date-fns';

interface DroppableDayColumnProps {
    date: Date;
    children: React.ReactNode;
    className?: string;
}

export const DroppableDayColumn: React.FC<DroppableDayColumnProps> = ({ date, children, className }) => {
    // STRICT FORMATTING: YYYY-MM-DD
    const dateId = format(date, 'yyyy-MM-dd');

    const { setNodeRef, isOver } = useDroppable({
        id: dateId,
        data: { date },
    });

    return (
        <div
            ref={setNodeRef}
            className={`${className || ''} ${isOver ? 'bg-orange-50 ring-2 ring-orange-200 ring-inset' : ''} transition-colors rounded-lg`}
        >
            {children}
        </div>
    );
};
