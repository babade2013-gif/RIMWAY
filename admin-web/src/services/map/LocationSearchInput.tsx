import { useState, useEffect, useRef } from 'react';
import { mapConfig } from './mapConfig';
import type { RideLocation } from './types';
import { PlacesService } from './placesService';

interface LocationSearchInputProps {
  label: string;
  placeholder: string;
  value: string;
  onChangeName: (name: string) => void;
  onSelectLocation: (location: RideLocation) => void;
  disabled?: boolean;
}

export default function LocationSearchInput({
  label,
  placeholder,
  value,
  onChangeName,
  onSelectLocation,
  disabled
}: LocationSearchInputProps) {
  const [suggestions, setSuggestions] = useState<RideLocation[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!value || value.length < 2) {
        setSuggestions([]);
        return;
      }
      const results = await PlacesService.searchPlaces(value);
      setSuggestions(results);
      setIsOpen(results.length > 0);
    };

    const debounce = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(debounce);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = async (suggestion: RideLocation) => {
    onChangeName(suggestion.name || '');
    setIsOpen(false);
    
    if (suggestion.placeId) {
      const details = await PlacesService.getPlaceDetails(suggestion.placeId);
      if (details) {
        onSelectLocation(details);
        return;
      }
    }
    // Fallback if no details
    onSelectLocation(suggestion);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <input
        type="text"
        className="mt-1 shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md px-3 py-2 border disabled:bg-gray-100"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChangeName(e.target.value)}
        onFocus={() => { if (suggestions.length > 0) setIsOpen(true); }}
        disabled={disabled || !mapConfig.isPlacesConfigured}
      />
      
      {!mapConfig.isPlacesConfigured && (
        <p className="mt-1 text-xs text-red-500">Search disabled (Places API not configured)</p>
      )}

      {isOpen && suggestions.length > 0 && mapConfig.isPlacesConfigured && (
        <ul className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto sm:text-sm">
          {suggestions.map((suggestion) => (
            <li
              key={suggestion.placeId}
              onClick={() => handleSelect(suggestion)}
              className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-blue-50"
            >
              <div className="flex flex-col">
                <span className="font-medium">{suggestion.name}</span>
                <span className="text-gray-500 text-xs">{suggestion.address}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
