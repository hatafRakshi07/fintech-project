'use client';

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar as CalendarIcon, MapPin, Gift, PhoneCall } from "lucide-react";

export default function CalendarPage() {
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  const { data: response, isLoading } = useQuery<{ success: boolean; data: any[] }>({
    queryKey: ["calendar", "events", dateRange],
    queryFn: () => {
      let query = "";
      if (dateRange.start) query += `?startDate=${dateRange.start}`;
      if (dateRange.end) query += `${query ? '&' : '?'}endDate=${dateRange.end}`;
      return customFetch(`/v2/calendar/events${query}`);
    }
  });

  const events = response?.data || [];

  // Group events by date (YYYY-MM-DD)
  const groupedEvents = events.reduce((acc, event) => {
    const dateStr = new Date(event.date).toISOString().split('T')[0];
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(event);
    return acc;
  }, {} as Record<string, any[]>);

  const sortedDates = Object.keys(groupedEvents).sort();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarIcon className="text-purple-500 h-6 w-6" />
            Operational Calendar
          </h1>
          <p className="text-muted-foreground">Unified view of upcoming Lucky Draws and field collection promises.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-gray-500" />
          <input 
            type="date" 
            className="border p-2 rounded text-sm"
            value={dateRange.start}
            onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
          />
          <span className="text-gray-400">to</span>
          <input 
            type="date" 
            className="border p-2 rounded text-sm"
            value={dateRange.end}
            onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-gray-500">Loading calendar events...</div>
      ) : sortedDates.length === 0 ? (
        <div className="p-12 text-center text-gray-500 border rounded-lg bg-gray-50/50">
          No draws or promises scheduled for this period.
        </div>
      ) : (
        <div className="space-y-8">
          {sortedDates.map(dateStr => (
            <div key={dateStr} className="relative pl-6 border-l-2 border-purple-100">
              <div className="absolute -left-2 top-0 w-4 h-4 rounded-full bg-purple-500 border-4 border-white shadow-sm" />
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                {new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                {dateStr === new Date().toISOString().split('T')[0] && (
                  <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full text-xs font-semibold ml-2">Today</span>
                )}
              </h2>
              
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {groupedEvents[dateStr].map((event: any) => (
                  <Card key={event.id} className={`overflow-hidden ${event.type === 'DRAW' ? 'border-amber-200' : 'border-blue-200'}`}>
                    <div className={`h-1 w-full ${event.type === 'DRAW' ? 'bg-amber-400' : 'bg-blue-400'}`} />
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {event.type === 'DRAW' ? (
                            <Gift className="w-5 h-5 text-amber-500" />
                          ) : (
                            <MapPin className="w-5 h-5 text-blue-500" />
                          )}
                          <span className={`text-xs font-bold uppercase tracking-wider ${event.type === 'DRAW' ? 'text-amber-600' : 'text-blue-600'}`}>
                            {event.type}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400">
                          {new Date(event.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                      
                      <h3 className="font-semibold text-gray-900 line-clamp-1">{event.title}</h3>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{event.description}</p>
                      
                      {event.type === 'PROMISE' && (
                        <div className="mt-4 flex items-center gap-2 text-sm text-blue-600 bg-blue-50 p-2 rounded-md">
                          <PhoneCall className="w-4 h-4" />
                          <span className="font-medium">Action Required</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
