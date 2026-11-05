import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
import { useState } from 'react';
import { useReactiveRoute } from './useReactiveRoute';
import { fetchDetourRoute, fetchDrivingRoute, detectRouteHazards } from '../services/routingService';
vi.mock('../services/routingService', () => ({fetchDetourRoute:vi.fn(),fetchDrivingRoute:vi.fn(),detectRouteHazards:vi.fn(()=>[])}));
const initial={coordinates:[[12.9,77.5],[13,77.6]],startCoords:{lat:12.9,lng:77.5},endCoords:{lat:13,lng:77.6},autoDetour:true,status:'ready'};
afterEach(()=>{vi.useRealTimers();vi.resetAllMocks();});
test('hazard changes recheck the route while the route dialog is closed, and offline marks it uncertain',async()=>{
 vi.useFakeTimers();fetchDetourRoute.mockResolvedValue({coordinates:initial.coordinates,conflicts:[{hazard:{id:'new'}}]});
 const {result,rerender}=renderHook(({hazards,connected})=>{const [route,setRoute]=useState(initial);useReactiveRoute(route,setRoute,hazards,connected);return route;},{initialProps:{hazards:[],connected:true}});
 expect(result.current.status).toBe('checking');await act(()=>vi.advanceTimersByTimeAsync(501));expect(result.current.status).toBe('ready');
 rerender({hazards:[{id:'new',position:{lat:12.95,lng:77.55}}],connected:true});expect(result.current.status).toBe('checking');await act(()=>vi.advanceTimersByTimeAsync(501));expect(fetchDetourRoute).toHaveBeenCalledTimes(2);expect(result.current.hasConflicts).toBe(true);
 rerender({hazards:[],connected:false});expect(result.current.status).toBe('offline');
});
test('late route responses cannot replace a newer hazard assessment',async()=>{
 vi.useFakeTimers();let first;fetchDetourRoute.mockImplementationOnce(()=>new Promise(r=>{first=r;})).mockResolvedValueOnce({coordinates:[[13,77.6]],conflicts:[]});
 const {result,rerender}=renderHook(({hazards})=>{const [route,setRoute]=useState(initial);useReactiveRoute(route,setRoute,hazards,true);return route;},{initialProps:{hazards:[]}});
 await act(()=>vi.advanceTimersByTimeAsync(501));rerender({hazards:[{id:'new'}]});await act(()=>vi.advanceTimersByTimeAsync(501));await act(async()=>first({coordinates:[[0,0]],conflicts:[]}));expect(result.current.coordinates).toEqual([[13,77.6]]);
});

test('loss of provider coverage rechecks an open route and keeps zero conflicts uncertain',async()=>{
 vi.useFakeTimers();fetchDetourRoute.mockResolvedValue({coordinates:initial.coordinates,conflicts:[]});
 const {result,rerender}=renderHook(({coverage})=>{const [route,setRoute]=useState(initial);useReactiveRoute(route,setRoute,[],true,coverage);return route;},{initialProps:{coverage:'current'}});
 await act(()=>vi.advanceTimersByTimeAsync(501));expect(result.current.status).toBe('ready');
 rerender({coverage:'incomplete'});expect(result.current.status).toBe('checking');await act(()=>vi.advanceTimersByTimeAsync(501));expect(result.current.status).toBe('incomplete');expect(result.current.hasConflicts).toBe(false);
});


test('direct routes retain detected conflict details as well as the warning flag',async()=>{
 vi.useFakeTimers();const conflict={hazard:{id:'closure',title:'Road closed'},distanceKm:0};
 fetchDrivingRoute.mockResolvedValue({coordinates:initial.coordinates});detectRouteHazards.mockReturnValue([conflict]);
 const {result}=renderHook(()=>{const [route,setRoute]=useState({...initial,autoDetour:false});useReactiveRoute(route,setRoute,[],true);return route;});
 await act(()=>vi.advanceTimersByTimeAsync(501));expect(result.current.hasConflicts).toBe(true);expect(result.current.conflicts).toEqual([conflict]);
});
