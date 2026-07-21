import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UserState {
    [key: string]: any
}

const initialState: UserState = {
    id: null,
    name: '',
    email: '',
    permissions: [],
    pages: [],
    is_manager: false
};

export const userInfo = createSlice({
    name: 'user',
    initialState,
    reducers: {
        setUser: (state, action: PayloadAction<UserState>) => {
            state.id = action.payload.id;
            state.name = action.payload.name;
            state.email = action.payload.email;
            state.permissions = action.payload.permissions;
            state.pages = action.payload.pages;
            state.is_manager = action.payload.is_manager;
        },
        clearUser: (state) => {
            state.id = null;
            state.name = ''
            state.email = ''
            state.permissions = []
            state.pages = []
            state.is_manager = false
        },
    },
});

export const { setUser, clearUser } = userInfo.actions;
export default userInfo.reducer;
