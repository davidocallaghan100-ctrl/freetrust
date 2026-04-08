import { create } from "zustand";
import { persist } from "zustand/middleware";

interface OrganisationState {
  followedOrganisations: string[];
  follow: (id: string) => void;
  unfollow: (id: string) => void;
  isFollowing: (id: string) => boolean;
}

export const useOrganisationStore = create<OrganisationState>()(
  persist(
    (set, get) => ({
      followedOrganisations: [],
      follow: (id: string): void => {
        set((state) => ({
          followedOrganisations: state.followedOrganisations.includes(id)
            ? state.followedOrganisations
            : [...state.followedOrganisations, id],
        }));
      },
      unfollow: (id: string): void => {
        set((state) => ({
          followedOrganisations: state.followedOrganisations.filter((orgId) => orgId !== id),
        }));
      },
      isFollowing: (id: string): boolean => {
        return get().followedOrganisations.includes(id);
      },
    }),
    {
      name: "freetrust-followed-orgs",
    }
  )
);
