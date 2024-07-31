// This file is auto-generated by @hey-api/openapi-ts

export type Address = {
  /**
   * Unique code of the address
   */
  code: number;
  /**
   * Feature ID of the address
   */
  feature_id: number;
  /**
   * Plot or building number of the address
   */
  plot_or_building_number: string;
  /**
   * Plot or building number of the address
   */
  building_block_number: string | null;
  /**
   * Postal code of the address
   */
  postal_code: string;
  /**
   * Street information the address belongs to
   */
  street: FlatStreet | null;
  /**
   * Residential area information the address belongs to
   */
  residential_area: FlatResidentialArea | null;
  /**
   * Municipality information the address belongs to
   */
  municipality: ShortMunicipality;
  /**
   * Point geometry of the address
   */
  geometry: Geometry;
};

export type AddressSearchSortBy =
  | 'code'
  | 'plot_or_building_number'
  | 'building_block_number'
  | 'postal_code'
  | 'feature_id'
  | 'created_at';

export type AddressesFilter = {
  /**
   * Filter by codes
   */
  codes?: Array<number> | null;
  /**
   * Filter by feature IDs
   */
  feature_ids?: Array<number> | null;
  /**
   * Filter by plot or building number
   */
  plot_or_building_number?: StringFilter | null;
  /**
   * Filter by building block number
   */
  building_block_number?: StringFilter | null;
  /**
   * Filter by postal code
   */
  postal_code?: StringFilter | null;
};

export type AddressesSearchFilterRequest = {
  /**
   * Filter by geometry
   */
  geometry?: GeometryFilter | null;
  /**
   * Filter by counties
   */
  counties?: CountiesFilter | null;
  /**
   * Filter by municipalities
   */
  municipalities?: MunicipalitiesFilter | null;
  /**
   * Filter by residential areas
   */
  residential_areas?: ResidentialAreasFilter | null;
  /**
   * Filter by streets
   */
  streets?: StreetsFilter | null;
  /**
   * Filter by addresses
   */
  addresses?: AddressesFilter | null;
};

export type AddressesSearchRequest = {
  /**
   * A list of filters to apply for searching addresses, combined using OR logic.
   */
  filters?: Array<AddressesSearchFilterRequest>;
};

export type CountiesFilter = {
  /**
   * Filter by codes
   */
  codes?: Array<number> | null;
  /**
   * Filter by feature IDs
   */
  feature_ids?: Array<number> | null;
  /**
   * Filter by name
   */
  name?: StringFilter | null;
};

export type CountiesSearchFilterRequest = {
  /**
   * Filter by geometry
   */
  geometry?: GeometryFilter | null;
  /**
   * Filter by counties
   */
  counties?: CountiesFilter | null;
};

export type CountiesSearchRequest = {
  /**
   * A list of filters to apply for searching counties, combined using OR logic.
   */
  filters?: Array<CountiesSearchFilterRequest>;
};

export type County = {
  /**
   * Unique code of the county
   */
  code: number;
  /**
   * Feature ID of the county
   */
  feature_id: number;
  /**
   * Name of the county
   */
  name: string;
  /**
   * Area of the county in hectares
   */
  area_ha: number;
  /**
   * Date of creation of the county
   */
  created_at: string;
};

export type CountyWithGeometry = {
  /**
   * Unique code of the county
   */
  code: number;
  /**
   * Feature ID of the county
   */
  feature_id: number;
  /**
   * Name of the county
   */
  name: string;
  /**
   * Area of the county in hectares
   */
  area_ha: number;
  /**
   * Date of creation of the county
   */
  created_at: string;
  /**
   * Geometry information of the county
   */
  geometry: Geometry;
};

export type CursorPage_Address_ = {
  items: Array<Address>;
  /**
   * Total items
   */
  total?: number | null;
  /**
   * Cursor to refetch the current page
   */
  current_page?: string | null;
  /**
   * Cursor to refetch the current page starting from the last item
   */
  current_page_backwards?: string | null;
  /**
   * Cursor for the previous page
   */
  previous_page?: string | null;
  /**
   * Cursor for the next page
   */
  next_page?: string | null;
};

export type CursorPage_County_ = {
  items: Array<County>;
  /**
   * Total items
   */
  total?: number | null;
  /**
   * Cursor to refetch the current page
   */
  current_page?: string | null;
  /**
   * Cursor to refetch the current page starting from the last item
   */
  current_page_backwards?: string | null;
  /**
   * Cursor for the previous page
   */
  previous_page?: string | null;
  /**
   * Cursor for the next page
   */
  next_page?: string | null;
};

export type CursorPage_Eldership_ = {
  items: Array<Eldership>;
  /**
   * Total items
   */
  total?: number | null;
  /**
   * Cursor to refetch the current page
   */
  current_page?: string | null;
  /**
   * Cursor to refetch the current page starting from the last item
   */
  current_page_backwards?: string | null;
  /**
   * Cursor for the previous page
   */
  previous_page?: string | null;
  /**
   * Cursor for the next page
   */
  next_page?: string | null;
};

export type CursorPage_Municipality_ = {
  items: Array<Municipality>;
  /**
   * Total items
   */
  total?: number | null;
  /**
   * Cursor to refetch the current page
   */
  current_page?: string | null;
  /**
   * Cursor to refetch the current page starting from the last item
   */
  current_page_backwards?: string | null;
  /**
   * Cursor for the previous page
   */
  previous_page?: string | null;
  /**
   * Cursor for the next page
   */
  next_page?: string | null;
};

export type CursorPage_ResidentialArea_ = {
  items: Array<ResidentialArea>;
  /**
   * Total items
   */
  total?: number | null;
  /**
   * Cursor to refetch the current page
   */
  current_page?: string | null;
  /**
   * Cursor to refetch the current page starting from the last item
   */
  current_page_backwards?: string | null;
  /**
   * Cursor for the previous page
   */
  previous_page?: string | null;
  /**
   * Cursor for the next page
   */
  next_page?: string | null;
};

export type CursorPage_Room_ = {
  items: Array<Room>;
  /**
   * Total items
   */
  total?: number | null;
  /**
   * Cursor to refetch the current page
   */
  current_page?: string | null;
  /**
   * Cursor to refetch the current page starting from the last item
   */
  current_page_backwards?: string | null;
  /**
   * Cursor for the previous page
   */
  previous_page?: string | null;
  /**
   * Cursor for the next page
   */
  next_page?: string | null;
};

export type CursorPage_Street_ = {
  items: Array<Street>;
  /**
   * Total items
   */
  total?: number | null;
  /**
   * Cursor to refetch the current page
   */
  current_page?: string | null;
  /**
   * Cursor to refetch the current page starting from the last item
   */
  current_page_backwards?: string | null;
  /**
   * Cursor for the previous page
   */
  previous_page?: string | null;
  /**
   * Cursor for the next page
   */
  next_page?: string | null;
};

export type Eldership = {
  /**
   * Unique code of the eldership
   */
  code: number;
  /**
   * Name of the eldership
   */
  name: string;
  /**
   * Feature ID of the eldership
   */
  feature_id: number;
  /**
   * Area of the eldership in hectares
   */
  area_ha: number;
  /**
   * Municipality information the eldership belongs to
   */
  municipality: ShortMunicipality;
  /**
   * Date of creation of the eldership
   */
  created_at: string;
};

export type EldershipWithGeometry = {
  /**
   * Unique code of the eldership
   */
  code: number;
  /**
   * Name of the eldership
   */
  name: string;
  /**
   * Feature ID of the eldership
   */
  feature_id: number;
  /**
   * Area of the eldership in hectares
   */
  area_ha: number;
  /**
   * Municipality information the eldership belongs to
   */
  municipality: ShortMunicipality;
  /**
   * Date of creation of the eldership
   */
  created_at: string;
  /**
   * Geometry information of the eldership
   */
  geometry: Geometry;
};

export type EldershipsFilter = {
  /**
   * Filter by codes
   */
  codes?: Array<number> | null;
  /**
   * Filter by feature IDs
   */
  feature_ids?: Array<number> | null;
  /**
   * Filter by name
   */
  name?: StringFilter | null;
};

export type EldershipsSearchFilterRequest = {
  /**
   * Filter by geometry
   */
  geometry?: GeometryFilter | null;
  /**
   * Filter by counties
   */
  counties?: CountiesFilter | null;
  /**
   * Filter by municipalities
   */
  municipalities?: MunicipalitiesFilter | null;
  /**
   * Filter by elderships
   */
  elderships?: EldershipsFilter | null;
};

export type EldershipsSearchRequest = {
  /**
   * A list of filters to apply for searching elderships, combined using OR logic.
   */
  filters?: Array<EldershipsSearchFilterRequest>;
};

export type FlatResidentialArea = {
  /**
   * Unique code of the residential area
   */
  code: number;
  /**
   * Feature ID of the residential area
   */
  feature_id: number;
  /**
   * Name of the residential area
   */
  name: string;
};

export type FlatStreet = {
  /**
   * Unique code of the street
   */
  code: number;
  /**
   * Feature ID of the street
   */
  feature_id: number;
  /**
   * Name of the street
   */
  name: string;
  /**
   * The full name of the street, including its type
   */
  full_name: string;
};

export type Geometry = {
  /**
   * Spatial Reference Identifier (SRID) for the geometry
   */
  srid: number;
  /**
   * Geometry data in WKB (Well-Known Binary) format, represented as a hex string
   */
  data: string;
};

export type GeometryFilter = {
  /**
   * Defines method used for filtering geometries:
   * - **`intersects`**: filter geometries that intersects any portion of space with the specified geometry.
   * - **`contains`**: filter geometries that are completely within the specified geometry.
   */
  method?: GeometryFilterMethod;
  /**
   * Extended Well-Known Binary (EWKB) represented as a hex string for geometry filtering
   */
  ewkb?: string | null;
  /**
   * Extended Well-Known Text (EWKT) for geometry filtering
   */
  ewkt?: string | null;
  /**
   * GeoJson for geometry filtering
   */
  geojson?: string | null;
};

export type GeometryFilterMethod = 'intersects' | 'contains';

export type GeometryOutputFormat = 'ewkt' | 'ewkb';

export type HTTPExceptionResponse = {
  /**
   * Detailed error message
   */
  detail: string;
};

export type HTTPValidationError = {
  detail?: Array<ValidationError>;
};

/**
 * Response model to validate and return when performing a health check.
 */
export type HealthCheck = {
  /**
   * Health status of the service
   */
  healthy: boolean;
};

export type MunicipalitiesFilter = {
  /**
   * Filter by codes
   */
  codes?: Array<number> | null;
  /**
   * Filter by feature IDs
   */
  feature_ids?: Array<number> | null;
  /**
   * Filter by name
   */
  name?: StringFilter | null;
};

export type MunicipalitiesSearchFilterRequest = {
  /**
   * Filter by geometry
   */
  geometry?: GeometryFilter | null;
  /**
   * Filter by counties
   */
  counties?: CountiesFilter | null;
  /**
   * Filter by municipalities
   */
  municipalities?: MunicipalitiesFilter | null;
};

export type MunicipalitiesSearchRequest = {
  /**
   * A list of filters to apply for searching municipalities, combined using OR logic.
   */
  filters?: Array<MunicipalitiesSearchFilterRequest>;
};

export type Municipality = {
  /**
   * Unique code of the municipality
   */
  code: number;
  /**
   * Feature ID of the municipality
   */
  feature_id: number;
  /**
   * Name of the municipality
   */
  name: string;
  /**
   * County information the municipality belongs to
   */
  county: ShortCounty;
  /**
   * Area of the municipality in hectares
   */
  area_ha: number;
  /**
   * Date of creation of the municipality
   */
  created_at: string;
};

export type MunicipalityWithGeometry = {
  /**
   * Unique code of the municipality
   */
  code: number;
  /**
   * Feature ID of the municipality
   */
  feature_id: number;
  /**
   * Name of the municipality
   */
  name: string;
  /**
   * County information the municipality belongs to
   */
  county: ShortCounty;
  /**
   * Area of the municipality in hectares
   */
  area_ha: number;
  /**
   * Date of creation of the municipality
   */
  created_at: string;
  /**
   * Geometry information of the municipality
   */
  geometry: Geometry;
};

export type ResidentialArea = {
  /**
   * Unique code of the residential area
   */
  code: number;
  /**
   * Feature ID of the residential area
   */
  feature_id: number;
  /**
   * Name of the residential area
   */
  name: string;
  /**
   * Municipality information the residential area belongs to
   */
  municipality: ShortMunicipality;
  /**
   * Area of the residential area in hectares
   */
  area_ha: number;
  /**
   * Date of creation of the residential area
   */
  created_at: string;
};

export type ResidentialAreaWithGeometry = {
  /**
   * Unique code of the residential area
   */
  code: number;
  /**
   * Feature ID of the residential area
   */
  feature_id: number;
  /**
   * Name of the residential area
   */
  name: string;
  /**
   * Municipality information the residential area belongs to
   */
  municipality: ShortMunicipality;
  /**
   * Area of the residential area in hectares
   */
  area_ha: number;
  /**
   * Date of creation of the residential area
   */
  created_at: string;
  /**
   * Geometry information of the residential area
   */
  geometry: Geometry;
};

export type ResidentialAreasFilter = {
  /**
   * Filter by codes
   */
  codes?: Array<number> | null;
  /**
   * Filter by feature IDs
   */
  feature_ids?: Array<number> | null;
  /**
   * Filter by name
   */
  name?: StringFilter | null;
};

export type ResidentialAreasSearchFilterRequest = {
  /**
   * Filter by geometry
   */
  geometry?: GeometryFilter | null;
  /**
   * Filter by counties
   */
  counties?: CountiesFilter | null;
  /**
   * Filter by municipalities
   */
  municipalities?: MunicipalitiesFilter | null;
  /**
   * Filter by residential areas
   */
  residential_areas?: ResidentialAreasFilter | null;
};

export type ResidentialAreasSearchRequest = {
  /**
   * A list of filters to apply for searching residential areas, combined using OR logic.
   */
  filters?: Array<ResidentialAreasSearchFilterRequest>;
};

export type Room = {
  /**
   * Unique code of the room
   */
  code: number;
  /**
   * Room number in the building or building section
   */
  room_number: string;
  /**
   * Date of creation of the room address
   */
  created_at: string;
  /**
   * Point geometry of the address
   */
  geometry: Geometry;
  /**
   * Address of the room
   */
  address: ShortAddress;
};

export type RoomsFilter = {
  /**
   * Filter by codes
   */
  codes?: Array<number> | null;
  /**
   * Filter by room number
   */
  room_number?: StringFilter | null;
};

export type RoomsSearchFilterRequest = {
  /**
   * Filter by geometry
   */
  geometry?: GeometryFilter | null;
  /**
   * Filter by counties
   */
  counties?: CountiesFilter | null;
  /**
   * Filter by municipalities
   */
  municipalities?: MunicipalitiesFilter | null;
  /**
   * Filter by residential areas
   */
  residential_areas?: ResidentialAreasFilter | null;
  /**
   * Filter by streets
   */
  streets?: StreetsFilter | null;
  /**
   * Filter by addresses
   */
  addresses?: AddressesFilter | null;
  /**
   * Filter by rooms
   */
  rooms?: RoomsFilter | null;
};

export type RoomsSearchRequest = {
  /**
   * A list of filters to apply for searching rooms, combined using OR logic.
   */
  filters?: Array<RoomsSearchFilterRequest>;
};

export type RoomsSearchSortBy = 'code' | 'room_number' | 'created_at';

export type SearchSortBy = 'code' | 'name' | 'feature_id' | 'created_at';

export type SearchSortOrder = 'asc' | 'desc';

export type ShortAddress = {
  /**
   * Unique code of the address
   */
  code: number;
  /**
   * Feature ID of the address
   */
  feature_id: number;
  /**
   * Plot or building number of the address
   */
  plot_or_building_number: string;
  /**
   * Plot or building number of the address
   */
  building_block_number: string | null;
  /**
   * Postal code of the address
   */
  postal_code: string;
  /**
   * Street information the address belongs to
   */
  street: FlatStreet | null;
  /**
   * Residential area information the address belongs to
   */
  residential_area: FlatResidentialArea | null;
  /**
   * Municipality information the address belongs to
   */
  municipality: ShortMunicipality;
};

export type ShortCounty = {
  /**
   * Unique code of the county
   */
  code: number;
  /**
   * Feature ID of the county
   */
  feature_id: number;
  /**
   * Name of the county
   */
  name: string;
};

export type ShortMunicipality = {
  /**
   * Unique code of the municipality
   */
  code: number;
  /**
   * Feature ID of the municipality
   */
  feature_id: number;
  /**
   * Name of the municipality
   */
  name: string;
  /**
   * County information the municipality belongs to
   */
  county: ShortCounty;
};

export type ShortResidentialArea = {
  /**
   * Unique code of the residential area
   */
  code: number;
  /**
   * Feature ID of the residential area
   */
  feature_id: number;
  /**
   * Name of the residential area
   */
  name: string;
  /**
   * Municipality information the residential area belongs to
   */
  municipality: ShortMunicipality;
};

export type Street = {
  /**
   * Unique code of the street
   */
  code: number;
  /**
   * Feature ID of the street
   */
  feature_id: number;
  /**
   * Name of the street
   */
  name: string;
  /**
   * The full name of the street, including its type
   */
  full_name: string;
  /**
   * The total length of the street in meters
   */
  length_m: number;
  /**
   * Date of creation of the street
   */
  created_at: string;
  /**
   * Residential area information the street belongs to
   */
  residential_area: ShortResidentialArea;
};

export type StreetWithGeometry = {
  /**
   * Unique code of the street
   */
  code: number;
  /**
   * Feature ID of the street
   */
  feature_id: number;
  /**
   * Name of the street
   */
  name: string;
  /**
   * The full name of the street, including its type
   */
  full_name: string;
  /**
   * The total length of the street in meters
   */
  length_m: number;
  /**
   * Date of creation of the street
   */
  created_at: string;
  /**
   * Residential area information the street belongs to
   */
  residential_area: ShortResidentialArea;
  /**
   * Line geometry information of the street
   */
  geometry: Geometry;
};

export type StreetsFilter = {
  /**
   * Filter by codes
   */
  codes?: Array<number> | null;
  /**
   * Filter by feature IDs
   */
  feature_ids?: Array<number> | null;
  /**
   * Filter by name
   */
  name?: StringFilter | null;
  /**
   * Filter by full name
   */
  full_name?: StringFilter | null;
};

export type StreetsSearchFilterRequest = {
  /**
   * Filter by geometry
   */
  geometry?: GeometryFilter | null;
  /**
   * Filter by counties
   */
  counties?: CountiesFilter | null;
  /**
   * Filter by municipalities
   */
  municipalities?: MunicipalitiesFilter | null;
  /**
   * Filter by residential areas
   */
  residential_areas?: ResidentialAreasFilter | null;
  /**
   * Filter by streets
   */
  streets?: StreetsFilter | null;
};

export type StreetsSearchRequest = {
  /**
   * A list of filters to apply for searching streets, combined using OR logic.
   */
  filters?: Array<StreetsSearchFilterRequest>;
};

export type StringFilter = {
  /**
   * Filter by containing a string (case insensitive)
   */
  contains?: string | null;
  /**
   * Filter by exact string (case insensitive)
   */
  exact?: string | null;
  /**
   * Filter by starting with a string (case insensitive)
   */
  starts?: string | null;
};

export type ValidationError = {
  loc: Array<string | number>;
  msg: string;
  type: string;
};

export type CountiesSearchData = {
  /**
   * Cursor for the next page
   */
  cursor?: string | null;
  requestBody: CountiesSearchRequest;
  /**
   * Page size
   */
  size?: number;
  sortBy?: SearchSortBy;
  sortOrder?: SearchSortOrder;
};

export type CountiesSearchResponse = CursorPage_County_;

export type CountiesGetData = {
  /**
   * The code of the county to retrieve
   */
  code: number;
};

export type CountiesGetResponse = County;

export type CountiesGetWithGeometryData = {
  /**
   * The code of the county to retrieve
   */
  code: number;
  /**
   * Specify the format for geometry output.
   */
  geometryOutputFormat?: GeometryOutputFormat;
  /**
   * A spatial reference identifier (SRID) for geometry output.
   */
  srid?: number;
};

export type CountiesGetWithGeometryResponse = CountyWithGeometry;

export type MunicipalitiesSearchData = {
  /**
   * Cursor for the next page
   */
  cursor?: string | null;
  requestBody: MunicipalitiesSearchRequest;
  /**
   * Page size
   */
  size?: number;
  sortBy?: SearchSortBy;
  sortOrder?: SearchSortOrder;
};

export type MunicipalitiesSearchResponse = CursorPage_Municipality_;

export type MunicipalitiesGetData = {
  /**
   * The code of the municipality to retrieve
   */
  code: number;
};

export type MunicipalitiesGetResponse = Municipality;

export type MunicipalitiesGetWithGeometryData = {
  /**
   * The code of the municipality to retrieve
   */
  code: number;
  /**
   * Specify the format for geometry output.
   */
  geometryOutputFormat?: GeometryOutputFormat;
  /**
   * A spatial reference identifier (SRID) for geometry output.
   */
  srid?: number;
};

export type MunicipalitiesGetWithGeometryResponse = MunicipalityWithGeometry;

export type EldershipsSearchData = {
  /**
   * Cursor for the next page
   */
  cursor?: string | null;
  requestBody: EldershipsSearchRequest;
  /**
   * Page size
   */
  size?: number;
  sortBy?: SearchSortBy;
  sortOrder?: SearchSortOrder;
};

export type EldershipsSearchResponse = CursorPage_Eldership_;

export type EldershipsGetData = {
  /**
   * The code of the eldership to retrieve
   */
  code: number;
};

export type EldershipsGetResponse = Eldership;

export type EldershipsGetWithGeometryData = {
  /**
   * The code of the eldership to retrieve
   */
  code: number;
  /**
   * Specify the format for geometry output.
   */
  geometryOutputFormat?: GeometryOutputFormat;
  /**
   * A spatial reference identifier (SRID) for geometry output.
   */
  srid?: number;
};

export type EldershipsGetWithGeometryResponse = EldershipWithGeometry;

export type ResidentialAreasSearchData = {
  /**
   * Cursor for the next page
   */
  cursor?: string | null;
  requestBody: ResidentialAreasSearchRequest;
  /**
   * Page size
   */
  size?: number;
  sortBy?: SearchSortBy;
  sortOrder?: SearchSortOrder;
};

export type ResidentialAreasSearchResponse = CursorPage_ResidentialArea_;

export type ResidentialAreasGetData = {
  /**
   * The code of the residential area to retrieve
   */
  code: number;
};

export type ResidentialAreasGetResponse = ResidentialArea;

export type ResidentialAreasGetWithGeometryData = {
  /**
   * The code of the residential area to retrieve
   */
  code: number;
  /**
   * Specify the format for geometry output.
   */
  geometryOutputFormat?: GeometryOutputFormat;
  /**
   * A spatial reference identifier (SRID) for geometry output.
   */
  srid?: number;
};

export type ResidentialAreasGetWithGeometryResponse = ResidentialAreaWithGeometry;

export type StreetsSearchData = {
  /**
   * Cursor for the next page
   */
  cursor?: string | null;
  requestBody: StreetsSearchRequest;
  /**
   * Page size
   */
  size?: number;
  sortBy?: SearchSortBy;
  sortOrder?: SearchSortOrder;
};

export type StreetsSearchResponse = CursorPage_Street_;

export type StreetsGetData = {
  /**
   * The code of the street to retrieve
   */
  code: number;
};

export type StreetsGetResponse = Street;

export type StreetsGetWithGeometryData = {
  /**
   * The code of the street to retrieve
   */
  code: number;
  /**
   * Specify the format for geometry output.
   */
  geometryOutputFormat?: GeometryOutputFormat;
  /**
   * A spatial reference identifier (SRID) for geometry output.
   */
  srid?: number;
};

export type StreetsGetWithGeometryResponse = StreetWithGeometry;

export type AddressesSearchData = {
  /**
   * Cursor for the next page
   */
  cursor?: string | null;
  /**
   * Specify the format for geometry output.
   */
  geometryOutputFormat?: GeometryOutputFormat;
  requestBody: AddressesSearchRequest;
  /**
   * Page size
   */
  size?: number;
  sortBy?: AddressSearchSortBy;
  sortOrder?: SearchSortOrder;
  /**
   * A spatial reference identifier (SRID) for geometry output.
   */
  srid?: number;
};

export type AddressesSearchResponse = CursorPage_Address_;

export type AddressesGetData = {
  /**
   * The code of the address to retrieve
   */
  code: number;
  /**
   * Specify the format for geometry output.
   */
  geometryOutputFormat?: GeometryOutputFormat;
  /**
   * A spatial reference identifier (SRID) for geometry output.
   */
  srid?: number;
};

export type AddressesGetResponse = Address;

export type RoomsSearchData = {
  /**
   * Cursor for the next page
   */
  cursor?: string | null;
  geometryOutputFormat?: GeometryOutputFormat;
  requestBody: RoomsSearchRequest;
  /**
   * Page size
   */
  size?: number;
  sortBy?: RoomsSearchSortBy;
  sortOrder?: SearchSortOrder;
  /**
   * A spatial reference identifier (SRID) for geometry output.
   */
  srid?: number;
};

export type RoomsSearchResponse = CursorPage_Room_;

export type RoomsGetData = {
  /**
   * The code of the room to retrieve
   */
  code: number;
  /**
   * Specify the format for geometry output.
   */
  geometryOutputFormat?: GeometryOutputFormat;
  /**
   * A spatial reference identifier (SRID) for geometry output.
   */
  srid?: number;
};

export type RoomsGetResponse = Room;

export type GetHealthHealthGetResponse = HealthCheck;

export type $OpenApiTs = {
  '/v1/counties/search': {
    post: {
      req: CountiesSearchData;
      res: {
        /**
         * A paginated list of counties matching the search criteria.
         */
        200: CursorPage_County_;
        /**
         * Validation Error
         */
        422: HTTPValidationError;
      };
    };
  };
  '/v1/counties/{code}': {
    get: {
      req: CountiesGetData;
      res: {
        /**
         * Details of the county with the specified code.
         */
        200: County;
        /**
         * County not found
         */
        404: HTTPExceptionResponse;
        /**
         * Validation Error
         */
        422: HTTPValidationError;
      };
    };
  };
  '/v1/counties/{code}/geometry': {
    get: {
      req: CountiesGetWithGeometryData;
      res: {
        /**
         * Details of the county with the specified code, including its geometry.
         */
        200: CountyWithGeometry;
        /**
         * County not found
         */
        404: HTTPExceptionResponse;
        /**
         * Validation Error
         */
        422: HTTPValidationError;
      };
    };
  };
  '/v1/municipalities/search': {
    post: {
      req: MunicipalitiesSearchData;
      res: {
        /**
         * A paginated list of municipalities matching the search criteria.
         */
        200: CursorPage_Municipality_;
        /**
         * Validation Error
         */
        422: HTTPValidationError;
      };
    };
  };
  '/v1/municipalities/{code}': {
    get: {
      req: MunicipalitiesGetData;
      res: {
        /**
         * Details of the municipality with the specified code.
         */
        200: Municipality;
        /**
         * Municipality not found
         */
        404: HTTPExceptionResponse;
        /**
         * Validation Error
         */
        422: HTTPValidationError;
      };
    };
  };
  '/v1/municipalities/{code}/geometry': {
    get: {
      req: MunicipalitiesGetWithGeometryData;
      res: {
        /**
         * Details of the municipality with the specified code, including its geometry.
         */
        200: MunicipalityWithGeometry;
        /**
         * Municipality not found
         */
        404: HTTPExceptionResponse;
        /**
         * Validation Error
         */
        422: HTTPValidationError;
      };
    };
  };
  '/v1/elderships/search': {
    post: {
      req: EldershipsSearchData;
      res: {
        /**
         * A paginated list of elderships matching the search criteria.
         */
        200: CursorPage_Eldership_;
        /**
         * Validation Error
         */
        422: HTTPValidationError;
      };
    };
  };
  '/v1/elderships/{code}': {
    get: {
      req: EldershipsGetData;
      res: {
        /**
         * Details of the eldership with the specified code.
         */
        200: Eldership;
        /**
         * Eldership not found
         */
        404: HTTPExceptionResponse;
        /**
         * Validation Error
         */
        422: HTTPValidationError;
      };
    };
  };
  '/v1/elderships/{code}/geometry': {
    get: {
      req: EldershipsGetWithGeometryData;
      res: {
        /**
         * Details of the eldership with the specified code, including its geometry.
         */
        200: EldershipWithGeometry;
        /**
         * Eldership not found
         */
        404: HTTPExceptionResponse;
        /**
         * Validation Error
         */
        422: HTTPValidationError;
      };
    };
  };
  '/v1/residential-areas/search': {
    post: {
      req: ResidentialAreasSearchData;
      res: {
        /**
         * A paginated list of residential areas matching the search criteria.
         */
        200: CursorPage_ResidentialArea_;
        /**
         * Validation Error
         */
        422: HTTPValidationError;
      };
    };
  };
  '/v1/residential-areas/{code}': {
    get: {
      req: ResidentialAreasGetData;
      res: {
        /**
         * Details of the residential area with the specified code.
         */
        200: ResidentialArea;
        /**
         * Residential area not found
         */
        404: HTTPExceptionResponse;
        /**
         * Validation Error
         */
        422: HTTPValidationError;
      };
    };
  };
  '/v1/residential-areas/{code}/geometry': {
    get: {
      req: ResidentialAreasGetWithGeometryData;
      res: {
        /**
         * Details of the residential area with the specified code, including its geometry.
         */
        200: ResidentialAreaWithGeometry;
        /**
         * Residential area not found
         */
        404: HTTPExceptionResponse;
        /**
         * Validation Error
         */
        422: HTTPValidationError;
      };
    };
  };
  '/v1/streets/search': {
    post: {
      req: StreetsSearchData;
      res: {
        /**
         * A paginated list of streets matching the search criteria.
         */
        200: CursorPage_Street_;
        /**
         * Validation Error
         */
        422: HTTPValidationError;
      };
    };
  };
  '/v1/streets/{code}': {
    get: {
      req: StreetsGetData;
      res: {
        /**
         * Details of the street with the specified code.
         */
        200: Street;
        /**
         * Street not found
         */
        404: HTTPExceptionResponse;
        /**
         * Validation Error
         */
        422: HTTPValidationError;
      };
    };
  };
  '/v1/streets/{code}/geometry': {
    get: {
      req: StreetsGetWithGeometryData;
      res: {
        /**
         * Details of the street with the specified code, including its geometry.
         */
        200: StreetWithGeometry;
        /**
         * Street not found
         */
        404: HTTPExceptionResponse;
        /**
         * Validation Error
         */
        422: HTTPValidationError;
      };
    };
  };
  '/v1/addresses/search': {
    post: {
      req: AddressesSearchData;
      res: {
        /**
         * A paginated list of addresses matching the search criteria.
         */
        200: CursorPage_Address_;
        /**
         * Validation Error
         */
        422: HTTPValidationError;
      };
    };
  };
  '/v1/addresses/{code}': {
    get: {
      req: AddressesGetData;
      res: {
        /**
         * Details of the address with the specified code.
         */
        200: Address;
        /**
         * Address not found
         */
        404: HTTPExceptionResponse;
        /**
         * Validation Error
         */
        422: HTTPValidationError;
      };
    };
  };
  '/v1/rooms/search': {
    post: {
      req: RoomsSearchData;
      res: {
        /**
         * A paginated list of rooms matching the search criteria.
         */
        200: CursorPage_Room_;
        /**
         * Validation Error
         */
        422: HTTPValidationError;
      };
    };
  };
  '/v1/rooms/{code}': {
    get: {
      req: RoomsGetData;
      res: {
        /**
         * Details of the room with the specified code.
         */
        200: Room;
        /**
         * Room not found
         */
        404: HTTPExceptionResponse;
        /**
         * Validation Error
         */
        422: HTTPValidationError;
      };
    };
  };
  '/health': {
    get: {
      res: {
        /**
         * Return HTTP Status Code 200 (OK)
         */
        200: HealthCheck;
        /**
         * Service Unavailable
         */
        503: HTTPExceptionResponse;
      };
    };
  };
};