export type AdminMenuCategory = {
  id: string;
  nameAr: string;
  nameEn: string | null;
  sortOrder: number;
  isActive: boolean;
};

export type AdminMenuItem = {
  id: string;
  categoryId: string;
  nameAr: string;
  nameEn: string | null;
  descriptionAr: string | null;
  price: number | null;
  preparationStation: "kitchen" | "barista" | "drinks" | "shisha";
  isAvailable: boolean;
  sortOrder: number;
};

export type MenuCategoryInput = {
  nameAr: string;
  nameEn?: string;
  sortOrder: number;
  isActive: boolean;
};

export type MenuItemInput = {
  categoryId: string;
  nameAr: string;
  nameEn?: string;
  descriptionAr?: string;
  price: number;
  preparationStation: AdminMenuItem["preparationStation"];
  isAvailable: boolean;
  sortOrder: number;
};
